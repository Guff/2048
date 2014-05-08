// ==UserScript==
// @name        tfe
// @namespace   http://gabrielecirulli.github.io/2048/
// @description 2048 bot
// @include     http://gabrielecirulli.github.io/2048/
// @version     1
// @grant       none
// ==/UserScript==

"use strict";

/**
 * @typedef {number[]} Column
 */

/**
 * @typedef {Column[]} Cells
 */

/**
 * @typedef {{weight: number, d: number}} MoveChoice
 */

/**
 * @typedef {{cells: Cells, score: number, removed: number}} MoveResult
 */

/**
 * @typedef {{x: number, y: number}} CellCoords
 */

/**
 *
 * @param {Cells} cells
 * @returns {Cells}
 */
function copyCells(cells) {
    var copy = [];

    for (var i = 0; i < cells.length; i++) {
        copy[i] = cells[i].slice(0);
//        for (var k = 0; k < cells[i].length; k++) {
//            copy[i][k] = cells[i][k];
//        }
    }

    return copy;
}

/**
 *
 * @param {Column} column
 * @returns {Column}
 */

function crunch(column) {
    var crunched = [], length = column.length;
    for (var i = 0; i < length; i++) {
        var cell = column[i];
        if (cell !== 0)
            crunched.push(cell);
    }
    return crunched;
}

/**
 *
 * @param {Column} column
 * @returns {{column: Column, score: number, removed: number}}
 */

function shiftColumn(column) {
    var crunched = crunch(column);
    var result = { column: [], score: 0, removed: 0 };

    for (var i = 0; i < crunched.length; i++) {
        if (crunched[i] === crunched[i + 1]) {
            result.column[i] = crunched[i] * 2;
            result.score += crunched[i] * 2;
            result.removed += 1 / Math.log(crunched[i]);
            crunched.splice(i + 1, 1);
        } else {
            result.column[i] = crunched[i];
        }
    }

    for (var k = i; k < column.length; k++)
        result.column[k] = 0;

//    window.console.log(shifted);

    return result;
}

/**
 *
 * @param {Cells} cells
 * @returns {Cells}
 */
function transpose(cells) {
    var ts = [];
    for (var y = 0; y < cells[0].length; y++) {
        ts.push([]);
        for (var x = 0; x < cells.length; x++) {
            ts[y][x] = cells[x][y];
        }
    }

    return ts;
}

/**
 *
 * @param {Cells} cells
 * @returns {Cells}
 */
function reverseColumns(cells) {
    var ts = [];
    for (var x = 0; x < cells.length; x++) {
        var column = cells[x];
        ts.push([]);
        var n = column.length;
        for (var y = 0; y < n; y++)
            ts[x][y] = column[n - y - 1];
    }

    return ts;
}

/**
 *
 * @param {Cells} cells
 * @param {number} d
 * @param {boolean=} inverse
 * @returns {Cells}
 */
function transform(cells, d, inverse) {
    switch (d) {
        case 1:
            return inverse ? transpose(reverseColumns(cells)) : reverseColumns(transpose(cells));
            break;
        case 2:
            return reverseColumns(cells);
            break;
        case 3:
            return transpose(cells);
            break;
        default:
            return copyCells(cells);
            break;
    }
}

/**
 *
 * @param {Cells=} grid
 * @constructor
 */
function State(grid) {
    if (grid)
        this.cells = grid; else
        this.loadState();
}

/**
 *
 * @param {MoveChoice[]} xs
 * @returns {number}
 */
function pickRandomByWeight(xs) {
//    window.console.log(xs);
    var weight_sum = xs.reduce(function (x0, x1) {
        return x0 + x1.weight;
    }, 0);

    var r = Math.random() * weight_sum;
//    window.console.log(r);
    var x;
    for (var i = 0; i < xs.length; i++) {
        x = xs[i];
        if (x.weight > r)
            return x.d;

        r -= x.weight;
    }

//    window.console.log(x, r);

    return x.d;
}

/**
 *
 * @param {MoveChoice[]} xs
 * @returns {number}
 */
function pickBest(xs) {
    var max_weight = -Infinity, k = 0;
    for (var i = 0; i < xs.length; i++) {
        var x = xs[i];
        if (x.weight >= max_weight) {
            max_weight = x.weight;
            k = i;
        }
    }


    return xs[k].d;
}

State.prototype.loadState = function () {
    this.grid = (new LocalStorageManager()).getGameState();
    if (this.grid === null)
        return;

    var game_state = this.grid.grid.cells;

    this.cells = game_state.map(function (column) {
        return column.map(function (cell) {
            return cell == null ? 0 : cell.value;
        });
    });
};

/**
 *
 * @param {Cells} cells
 * @returns {boolean}
 */
function canMoveUp(cells) {
    // check for gaps as well as consecutive identical cells
    for (var x = 0; x < cells.length; x++) {
        var seen_empty = false;
        var column = cells[x];
        var cell, y;
        for (y = 0; y < column.length; y++) {
            cell = column[y];
            if (cell === 0) {

                seen_empty = true;
            } else if (seen_empty) {
                return true;
            }
        }

        var column_crunched = crunch(cells[x]);
        for (y = 0; y < column_crunched.length; y++) {
            cell = column_crunched[y];
            if (cell && cell === column_crunched[y + 1])
                return true;
        }
    }

    return false;
}

/**
 *
 * @param {Cells} cells
 * @returns {MoveResult}
 */
function moveUp(cells) {
    var result = { cells: copyCells(cells), score: 0, removed: 0 };
    for (var x = 0; x < cells.length; x++) {
        var shift_result = shiftColumn(result.cells[x]);
        result.cells[x] = shift_result.column;
        result.score += shift_result.score;
        result.removed += shift_result.removed;
    }

    return result;
}

/**
 *
 * @param {Cells} cells
 * @param {number} d
 * @returns {MoveResult}
 */
State.prototype.move = function (cells, d) {
    cells = transform(cells, d);
    /** @type {MoveResult} */
    var move_result = moveUp(cells);
    move_result.cells = transform(move_result.cells, d, true);
//    move_result.d = d;
    return move_result;
};

/**
 *
 * @param {Cells} cells
 * @param {number} d
 * @returns {boolean}
 */
function canMove(cells, d) {
    /** @type {Cells} */
    var transformed = transform(cells, d);
    return canMoveUp(transformed);
}

/**
 *
 * @param {Cells} cells
 * @returns {number[]}
 */
function getLegalMoves(cells) {
    var moves = [];
    for (var d = 0; d < 4; d++) {
        if (canMove(cells, d))
            moves.push(d);
    }

    return moves;
}

function columnSum(column) {
    var sum = 0;
    for (var i = 0; i < column.length; i++)
        sum += column[i];

    return sum;
}

/**
 *
 * @param {Column} column
 * @returns {number[]}
 */
function getColumnMonotonicity(column) {
    var crunched = crunch(column);
//    var m = columnSum(column);
    if (crunched.length == 0)
        return [0, 0];

    var m_l = crunched[0], m_r = crunched[crunched.length - 1]; // << (column.length - crunched.length);
    var crunched_map = [];
    var k = 0, i;
    for (i = 0; i < crunched.length; i++) {
        while (crunched[i] != column[k]) {
            k++;
        }
        crunched_map[i] = k;
    }
//    var m = columnSum(crunched) << (column.length - crunched.length);
    for (i = 1; i < crunched.length; i++) {
        if (crunched[i] >= crunched[i - 1]) {
            m_l += crunched[i] << (crunched_map[i]);
        } else {
            m_l -= (crunched[i - 1] - crunched[i]) << (crunched_map[i] + 1);
        }

        k = crunched.length - i - 1;

        if (crunched[k] >= crunched[k + 1]) {
            m_r += crunched[k] << (column.length - crunched_map[k] - 1);
        } else {
            m_r -= (crunched[k + 1] - crunched[k]) << (column.length - crunched_map[k]);
        }
    }

    return [m_l, m_r];
}

/**
 *
 * @param {Cells} cells
 * @returns {number}
 */
function getBestMonotonicity(cells) {
    var column_weight_l = 0, column_weight_l_d = 0, column_weight_r = 0, column_weight_r_d = 0;

    for (var x = 0; x < cells.length; x++) {
        var column = cells[x];
//        var column_r = column.slice(0).reverse();

        var weights = getColumnMonotonicity(column);

        column_weight_l += weights[0] << (x);
        column_weight_l_d += weights[0] << ((cells.length - x - 1));
        column_weight_r += weights[1] << (x);
        column_weight_r_d += weights[1] << ((cells.length - x - 1));
    }

    return Math.max(column_weight_l, column_weight_l_d, column_weight_r, column_weight_r_d);
}

/**
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function toVertex(x, y) {
    return x * 4 + y;
}

/**
 *
 * @param {Cells} cells
 * @param {number} v
 * @returns {number}
 */
function fromVertex(cells, v) {
    return cells[v >> 2][v & 3];
}

/**
 *
 * @param {number[]} q
 * @param {number[]} dist
 * @returns {number}
 */
function getMinDist(q, dist) {
    var min = Infinity, min_v, min_i;
    for (var i = 0; i < q.length; i++) {
        if (dist[q[i]] < min) {
            min_i = i;
            min_v = q[i];
            min = dist[min_v];
        }
    }

    q.splice(min_i, 1);
//    q.forEach(function (v) {
//        if (dist[v] < min) {
//            min = dist[v];
//            min_i = v;
//        }
//    });

    return min_v;
}

function getDistance(cells, source, dest) {
    var dist = [], prev = [], vertices = [], neighbors = [], q = [], v;

    for (var x = 0; x < cells.length; x++) {
        for (var y = 0; y < cells[x].length; y++) {
            v = toVertex(x, y);
            dist[v] = Infinity;
            prev[v] = null;
            vertices[v] = cells[x][y];
            neighbors[v] = [];
            q.push(v);

            for (var j = -1; j <= 1; j += 2) {
                if (x + j >= 0 && x + j < cells.length)
                    neighbors[v].push({v: toVertex(x + j, y), cost: cells[x + j][y]});

                if (y + j >= 0 && y + j < cells[x].length)
                    neighbors[v].push({v: toVertex(x, y + j), cost: cells[x][y + j]});
            }
        }
    }

    dist[toVertex(source.x, source.y)] = 0;

    var u;

    while (q.length) {
        u = getMinDist(q, dist);
//        u = dist.reduce(function (p, v, i) { return Math.min, Infinity);
//        q.splice(q.indexOf(u), 1);

        if (dist[u] == Infinity || u == toVertex(dest.x, dest.y))
            break;

        for (var i = 0; i < neighbors[u].length; i++) {
            v = neighbors[u][i].v;
            var cost = neighbors[u][i].cost;
            var alt = dist[u] + cost;
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
            }
        }
    }

    var weight = 0;
    u = toVertex(dest.x, dest.y);
//    while (prev[u]) {
//        weight += vertices[u];
//        u = prev[u];
//    }

    return dist[u];
}

function getBestCornerDistance(cells, cell) {
    var corners = [
        {x: 0, y: 0},
        {x: 3, y: 0},
        {x: 3, y: 3},
        {x: 0, y: 3}
    ];
    var dist = Infinity;
    for (var i = 0; i < corners.length; i++) {
        dist = Math.min(dist, getDistance(cells, cell, corners[i]));
    }

    return dist;
}

function getMaxCells(cells) {
    var xs = [];
    for (var x = 0; x < cells.length; x++) {
        for (var y = 0; y < cells[x].length; y++) {
            xs.push({x: x, y: y, v: cells[x][y]});
        }
    }

    xs.sort(function (a, b) {
        return b.v - a.v;
    });

    return xs.slice(0, 4);
}

function getMaxCell(cells) {
    var x, y, v = 0;

    for (x = 0; x < cells.length; x++) {
        for (y = 0; y < cells[x].length; y++) {
            v = Math.max(cells[x][y], v);
        }
    }

    return {x: x, y: y, v: v};
}

function getOneCornerWeight(cells, corner, cell) {
    if (cell.x != corner.x && cell.y != corner.y)
        return -cell.v;

    if (cell.x == corner.x && cell.y == corner.y)
        return cell.v;

    var d = cell.x == corner.x ? 'y' : 'x';
    var s = Math.sign(corner[d] - cell[d]);
    var weight = cell.v;
    for (var i = cell[d]; i != corner[d]; i += s) {
        var next_cell = d == 'x' ? cells[i][corner.y] : cells[corner.x][i];
        if (cells[i + s])
            weight -= weight - next_cell; else
            weight -= 1;
    }

    return weight;
}

function getMaxWeight(cells) {
    var max_cell = getMaxCell(cells);
    var corners = [
        {x: 0, y: 0},
        {x: 3, y: 0},
        {x: 3, y: 3},
        {x: 0, y: 3}
    ];

    var corner_weight = -Infinity;
    for (var i = 0; i < corners.length; i++) {
        var corner = corners[i];
        corner_weight = Math.max(corner_weight, getOneCornerWeight(cells, corner, max_cell));
    }

    return corner_weight;
}
/**
 *
 * @param {Cells} cells
 * @returns {Object.<number, number>}
 */
function getCellFrequency(cells) {
    var values = {};
    for (var x = 0; x < cells.length; x++) {
        for (var y = 0; y < cells.length; y++) {
            var cell = cells[x][y];
            values[cell] = cell in values ? values[cell] + 1 : 1;
        }
    }

    return values;
}

/**
 * @typedef {function (MoveResult): number} Metric
 */

/**
 *
 * @type {Object.<string, Metric>}}
 */
var metrics = {
    removed: function (move_result) {
        return move_result.removed;
    },
    score: function (move_result) {
        return move_result.removed;
    },
    random: function () {
        return Math.random();
    },
    distance: function (move_result) {
        var cells = move_result.cells;
        var maxes = getMaxCells(cells);
        var weight = 0;

        for (var i = 0; i < maxes.length; i++) {
            weight += maxes[i].v / (1 + getBestCornerDistance(cells, maxes[i]));
        }

        return weight;
    },
    monotonicity: function (move_result) {
        var cells = move_result.cells;
        var cells_rot = transform(cells, 1);
        var weight;

//        var max_cell = getMaxCell(cells);
//        var row_weight = 0, column_weight = 0;

        var column_weight = getBestMonotonicity(cells);
        var row_weight = getBestMonotonicity(cells_rot);
//        return column_weight;

//        return Math.max(column_weight, row_weight);
        return column_weight + row_weight;
    },
    moves: function (move_result) {
        return getLegalMoves(move_result.cells).length;
    },
    corner: function (move_result) {
        return getMaxWeight(move_result.cells);
    },
    monoRemoved: function (move_result) {
        return metrics.monotonicity(move_result) * (metrics.removed(move_result) / 4 + 1);
    },
    freq: function (move_result) {
        var values = getCellFrequency(move_result.cells);
        var weight = 0;
        for (var v in values) {
            if (values.hasOwnProperty(v)) {
                weight += Math.pow(v, 1 / values[v]);
            }
        }

        return weight;
    }
};

/**
 *
 * @param {Cells} cells
 * @param {number} d
 * @param {string} metric
 * @param {number} n
 * @returns {number}
 */
State.prototype.rankMoveRecursive = function (cells, d, metric, n) {
//    if (d === 0)
//        return -Infinity;

    var move_result = this.move(cells, d);
    var weight = metrics[metric](move_result);

//    if (this.getLegalMoves(move_result.cells).length == 0)

    if (n == 0)
        return weight;

    var max_move_weights = [];
    for (var x = 0; x < cells.length; x++) {
        max_move_weights[x] = [];
        for (var y = 0; y < cells[x].length; y++) {
            max_move_weights[x][y] = {2: -Infinity, 4: -Infinity};
        }
    }

    var updated_cells = move_result.cells;
    var next_states = this.getNextStates(updated_cells);
    for (var i = 0; i < next_states.length; i++) {
        var next_state = next_states[i];
        var moves = getLegalMoves(next_state.cells);
        if (moves.length === 0)
            continue;

        var max_move_weight = -Infinity;
        for (var k = 0; k < moves.length; k++) {
            var move_weight = next_state.weight * this.rankMoveRecursive(next_state.cells, moves[k], metric, n - 1);
//                var move_weight = this.rankMoveRecursive(next_state.cells, moves[k], metric, n - 1) / moves.length;
            max_move_weight = Math.max(move_weight, max_move_weight);
            x = next_state.x;
            y = next_state.y;
            max_move_weights[x][y][next_state.v] = Math.max(max_move_weights[x][y][next_state.v], move_weight);
//            if (next_state.cells[1][0] == 2)
//                window.console.log(move_weight)
//            if (x == 1 && y == 3 && n == 1 && next_state.v == 2)
//                window.console.log(next_state, moves[k], move_weight);
        }

        weight += max_move_weight;

//        weight += next_state.weight * sub_weight / next_states.length;
    }
//    if (n == 1)
//        window.console.log(max_move_weights);

    return weight;
};

State.prototype.rankMoveRecursive2 = function (cells, d, metric, n) {
//    if (d === 0)
//        return -Infinity;

    var move_result = this.move(cells, d);
    var weight = metrics[metric](move_result);

//    if (this.getLegalMoves(move_result.cells).length == 0)

    if (n == 0)
        return weight;

    var updated_cells = move_result.cells;

//    var moves = getLegalMoves(updated_cells);
    var max_move_weights = [];
    for (var x = 0; x < cells.length; x++) {
        max_move_weights[x] = [];
        for (var y = 0; y < cells[x].length; y++) {
            max_move_weights[x][y] = {2: -Infinity, 4: -Infinity};
        }
    }

    for (var i = 0; i < 4; i++) {
        var next_states = getNextStatesSmart(updated_cells, i);
        var move_weight;
        for (var k = 0; k < next_states.length; k++) {
            var next_state = next_states[k];

//            if (!canMove(next_state.cells, i))
//                continue;

            move_weight = next_state.weight * this.rankMoveRecursive2(next_state.cells, i, metric, n - 1);
            for (var j = 0; j < next_state.affected.length; j++) {
                var p = next_state.affected[j];
//                if (p.x == 1 && p.y == 3 && n == 1 && next_state.v == 2)
//                    window.console.log(next_state, i, move_weight);

                var v = next_state.v;
//                window.console.log(next_state);
                max_move_weights[p.x][p.y][v] = Math.max(max_move_weights[p.x][p.y][v], move_weight);
            }
        }

//        max_move_weight = Math.max(move_weight, max_move_weight);
    }

//    if (n == 1)
//        console.log(max_move_weights);

    for (x = 0; x < max_move_weights.length; x++) {
        for (y = 0; y < max_move_weights[x].length; y++) {
            var weight_2 = max_move_weights[x][y][2], weight_4 = max_move_weights[x][y][4];
            if (weight_2 != -Infinity)
                weight += weight_2;
            if (weight_4 != -Infinity)
                weight += weight_4;
        }
    }

    return weight;
};

/**
 *
 * @param {Cells} cells
 * @param {string} metric
 * @param {number} depth
 * @returns {number}
 */
State.prototype.pickMove = function (cells, metric, depth) {
//    window.console.log('picking');
    var moves = getLegalMoves(cells).map(function (d) {
        return { weight: this.rankMoveRecursive2(cells, d, metric, depth), d: d };
    }, this);

    return pickBest(moves);
};

State.prototype.getAvailableCells = function (cells) {
    var available = [];
    for (var x = 0; x < cells.length; x++) {
        var column = cells[x];
        for (var y = 0; y < column.length; y++) {
            var cell = column[y];
            if (cell === 0)
                available.push({x: x, y: y})
        }
    }

    return available;
};

function shuffle(xs, r) {
    for (var i = xs.length - 1; i > Math.floor(xs.length * (1 - r)); i--) {
        var j = Math.floor(Math.random() * i);
        var x0 = xs[i];
        xs[i] = xs[j];
        xs[j] = x0;
    }
//    window.console.log(xs);

    return xs.slice(Math.floor(xs.length * (1 - r)));
}

State.prototype.getNextStates = function (cells) {
    var available = this.getAvailableCells(cells);
//    available = shuffle(available, 0.333);
//    available = available.slice(0, Math.ceil(available.length / 4));
    var states = [];
    for (var i = 0; i < available.length; i++) {
        var pos = available[i];
        var updated_cells = copyCells(cells);
        updated_cells[pos.x][pos.y] = 2;
        states.push({weight: 0.9, cells: copyCells(updated_cells), x: pos.x, y: pos.y, v: 2});
        updated_cells[pos.x][pos.y] = 4;
        states.push({weight: 0.1, cells: updated_cells, x: pos.x, y: pos.y, v: 4});
    }

    return states;
};

function columnGetFreeUnique(column) {
    var free = [];
//    var counts = [];

    var seen_null = false;

    for (var i = 0; i < column.length; i++) {
        if (!column[i]) {
            if (!seen_null) {
                free.push({y: i, c: 0});
            }

            free[free.length - 1].c++;

            seen_null = true;
        } else {
            seen_null = false;
        }
    }

    return free;
}

function transformCoords(p, d, inverse) {
    var t;
    var q = {x: p.x, y: p.y};
    switch (d) {
        case 1:
            if (inverse) {
                t = q.x;
                q.x = 3 - q.y;
                q.y = t;
            } else {
                t = 3 - q.x;
                q.x = q.y;
                q.y = t;

            }
            break;
        case 2:
            q.y = 3 - q.y;
            break;
        case 3:
            t = q.x;
            q.x = q.y;
            q.y = t;
            break;
        default:
            break;
    }

    return q;
}

function getNextStatesSmart(orig_cells, d) {
    var cells = transform(orig_cells, d);
//    var frees = [];
    var states = [];

    for (var x = 0; x < cells.length; x++) {
        var free_ys = columnGetFreeUnique(cells[x]);
        for (var i = 0; i < free_ys.length; i++) {
            var updated_cells = copyCells(cells);
            var y = free_ys[i].y, c = free_ys[i].c;
            var affected_2 = [], affected_4 = [];

            for (var k = 0; k < c; k++) {
                var p = {x: x, y: y + k};
                var p_t = transformCoords(p, d, true);

                updated_cells[p.x][p.y] = 2;

                if (canMoveUp(updated_cells))
                    affected_2.push(p_t);

                updated_cells[p.x][p.y] = 4;

                if (canMoveUp(updated_cells))
                    affected_4.push(p_t);

                updated_cells[p.x][p.y] = 0;
            }

            var transformed = transform(updated_cells, d, true);
            var xy = transformCoords({x: x, y: y}, d, true);


            transformed[xy.x][xy.y] = 2;
            states.push({weight: 0.9, cells: copyCells(transformed), affected: affected_2, v: 2});
//            states.push({weight: 0.9, cells: transform(updated_cells, d, true), affected: affected_2, v: 2});
            transformed[xy.x][xy.y] = 4;
            states.push({weight: 0.1, cells: transformed, affected: affected_4, v: 4});
        }
    }


    return states;
}

var keyMap = {
    0: 38,
    1: 39,
    2: 40,
    3: 37
};

function makeMove(gm, d) {
    gm.move(d);
}

function checkCells(c0, c1) {
    for (var x = 0; x < c0.length; x++) {
        for (var y = 0; y < c0[x].length; y++) {
            if (c0[x][y] !== c1[x][y])
                return false;
        }
    }
    return true;
}

var t_iter = 0, t_time = 0;

window.onload = function () {
    var pauseButton = document.createElement('a');
//    pauseButton.textContent = 'Start/Stop';
    pauseButton.classList.add('pause-button');

    var recursionDepth = localStorage['recursionDepth'] || 1;

    var depthInput = document.createElement('input');
    depthInput.id = 'depth-input';
    depthInput.type = 'number';
    depthInput.size = 2;
    depthInput.min = '0';
    depthInput.max = '5';
    depthInput.step = '1';
    depthInput.value = recursionDepth;

    depthInput.addEventListener('change', function () {
        recursionDepth = localStorage['recursionDepth'] = this.value;
    });

    var depthLabel = document.createElement('label');
    depthLabel.setAttribute('for', 'depth-input');
    depthLabel.textContent = 'Depth';

    var selectedMetric = localStorage['selectedMetric'] || 'monotonicity';

    var metricSelect = document.createElement('select');
    metricSelect.id = 'metric-select';
    for (var m in metrics) {
        if (metrics.hasOwnProperty(m)) {
            var option = document.createElement('option');
            option.value = m;
            option.textContent = m;

            if (m == selectedMetric)
                option.setAttribute('selected', 'selected');

            metricSelect.appendChild(option);
        }
    }

    metricSelect.addEventListener('change', function () {
        selectedMetric = localStorage['selectedMetric'] = this.options[this.selectedIndex].value;
    });

    var metricLabel = document.createElement('label');
    metricLabel.setAttribute('for', 'metric-select');
    metricLabel.textContent = 'Metric';

    var running = false;
    var timeStep = localStorage['intervalTime'] || 150;

    var gm = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

    function isGameOver() {
        var s = new State();
        return (s.grid === null || typeof s.cells === 'undefined');
    }

//    function ()

    function startLoop() {
        if (isGameOver()) {
            gm.restart();
        }

        pauseButton.classList.add('stop');

        doMove();
    }

    function stopLoop() {
        pauseButton.classList.remove('stop');
//        window.clearInterval(intervalId);
//        intervalId = null;
    }

    function doMove() {
        var s = new State();
        if (s.grid === null || typeof s.cells === 'undefined') {
            running = false;
        }

        if (!running) {
            stopLoop();
            return;
        }

        var d = s.pickMove(s.cells, selectedMetric, recursionDepth);
        makeMove(gm, d);

        setTimeout(doMove, timeStep);
    }

    function toggleLoop() {
        running = !running;
        if (running) {
            startLoop();
        } else {
            stopLoop();
        }
    }

    var intervalRange = document.createElement('input');
    intervalRange.type = 'range';
    intervalRange.autocomplete = 'off';
    intervalRange.min = 10;
    intervalRange.max = 1000;
    intervalRange.step = 10;
    intervalRange.id = 'interval-range';
    intervalRange.classList.add('interval');

    intervalRange.value = timeStep;

    var interval = document.createElement('input');
    interval.type = 'number';
    interval.min = 10;
    interval.max = 1000;
    interval.step = 10;
    interval.id = 'interval';
    interval.classList.add('interval');
    interval.size = 5;

    interval.value = timeStep;

    var intervalLabel = document.createElement('label');
    intervalLabel.setAttribute('for', 'interval');
    intervalLabel.textContent = "Delay (ms)";

    function updateInterval(t) {
        localStorage['intervalTime'] = timeStep = t;
    }

    intervalRange.addEventListener('change', function () {
        interval.value = this.value;
        updateInterval(this.value);
    });

    interval.addEventListener('change', function () {
        intervalRange.value = this.value;
        updateInterval(this.value);
    });


    pauseButton.addEventListener('click', function () {
        if (isGameOver())
            gm.restart();

        toggleLoop();
    });

    document.addEventListener('keydown', function (e) {
        if (e.keyCode == 32) {
            if (isGameOver())
                gm.restart();

            toggleLoop();
            e.preventDefault();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.keyCode == 78) {
            var s = new State();
            var d = s.pickMove(s.cells, selectedMetric, recursionDepth);
            makeMove(gm, d);
        }
    });


    var above = document.getElementsByClassName('above-game')[0];
    above.appendChild(pauseButton);
    above.appendChild(intervalLabel);
    above.appendChild(intervalRange);
    above.appendChild(interval);
    above.appendChild(document.createElement('br'));
    above.appendChild(metricLabel);
    above.appendChild(metricSelect);
    above.appendChild(depthLabel);
    above.appendChild(depthInput);
};

window.State = State;

window.transpose = transpose;
window.reverseColumns = reverseColumns;
window.copyCells = copyCells;
window.shiftColumn = shiftColumn;
window.pickRandomByWeight = pickRandomByWeight;
window.pickBest = pickBest;
window.getColumnMonotonicity = getColumnMonotonicity;

function getRandomEmptyCell(cells) {
    var empties = [];
    for (var x = 0; x < cells.length; x++) {
        var row = cells[x];
        for (var y = 0; y < row.length; y++) {
            if (row[y] === 0)
                empties.push({x: x, y: y});
        }
    }
    if (empties.length)
        return empties[Math.floor(Math.random() * empties.length)]; else
        return null;
}

window.generateNewGrid = function () {
    var grid = [];
    for (var x = 0; x < 4; x++) {
        grid[x] = [];
        for (var y = 0; y < 4; y++) {
            grid[x][y] = 0;
        }
    }

    var c0 = getRandomEmptyCell(grid);
    grid[c0.x][c0.y] = Math.random() < 0.9 ? 2 : 4;
    var c1 = getRandomEmptyCell(grid);
    grid[c1.x][c1.y] = Math.random() < 0.9 ? 2 : 4;

    return grid;
};

function profileTest(n, metric, r) {
    window.console.profile();

    for (var i = 0; i < n; i++) {
        var cells = window.generateNewGrid();
        var s = new State(cells);
        s.pickMove(s.cells, metric, r);
    }

    window.console.profileEnd();
}

//window.profileTest = profileTest;

//profileTest(1, 'monotonicity', 3);