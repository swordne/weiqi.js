import Immutable from 'immutable';
import Constants from './constants';

class Point extends Immutable.Record({i: 0, j: 0}) {
  constructor(i, j) {
    super({i: i, j: j});
  }
}

function inBounds(size, point) {
  return point.i >= 0 && point.i < size && point.j >= 0 && point.j < size;
}

function getStone(stones, coords) {
  return stones.get(coords, Constants.EMPTY);
}

function replaceStone(stones, coords, value) {
  return stones.set(coords, value);
}

var deltas = Immutable.List.of(new Point(-1, 0),
                               new Point(0, 1),
                               new Point(1, 0),
                               new Point(0, -1));


/*
 * Given a board position, returns a list of [i,j] coordinates representing
 * orthagonally adjacent intersections
 */
function getAdjacentIntersections(size, coords) {
  var addPair = vec => new Point(vec.i + coords.i, vec.j + coords.j);
  return deltas.map(addPair).filter(coord => inBounds(size, coord));
}

function allPositions(size) {
  var range = Immutable.Range(0, size);
  return range.flatMap(i => range.map(j => new Point(i, j)));
}

/*
 * Performs a breadth-first search about an (i,j) position to find recursively
 * orthagonally adjacent stones of the same color (stones with which it shares
 * liberties). Returns null for if there is no stone at the specified position,
 * otherwise returns an object with two keys: "liberties", specifying the
 * number of liberties the group has, and "stones", the list of [i,j]
 * coordinates of the group's members.
 */
function getGroup(stones, size, coords) {
  var color = getStone(stones, coords);

  function search(visited, queue, surrounding) {
    if (queue.isEmpty())
      return {visited: visited, surrounding: surrounding};

    var stone = queue.first();
    queue = queue.shift();

    if (visited.has(stone))
      return search(visited, queue, surrounding);

    var neighbors = getAdjacentIntersections(size, stone);
    neighbors.forEach(n => {
      var state = getStone(stones, n);
      if (state == color)
        queue = queue.push(n);
      else
        surrounding = surrounding.set(n, state);
    });

    visited = visited.add(stone);
    return search(visited, queue, surrounding);
  }

  var {visited, surrounding} = search(Immutable.Set(), Immutable.List([coords]), Immutable.Map());
  var liberties = surrounding.filter(color => color == Constants.EMPTY);

  return Immutable.Map({'liberties'  : liberties.size,
                        'stones'     : visited,
                        'surrounding': surrounding});
}

export function createBoard(size, stones) {
  if (typeof size === "undefined" || size < 0)
    throw "Size must be an integer greater than zero";

  if (typeof stones === "undefined")
    stones = Immutable.Map();

  var Board = {

    getStone: coords => getStone(stones, new Point(coords[0], coords[1])),

    toArray: function() {
      return this.getIntersections().toJS();
    },

    getStones: color => stones
      .filter((stoneColor) => stoneColor == color)
      .keySeq()
      .map((point) => [point.i, point.j])
      .toJS(),

    getSize: () => size,

    getIntersections: () => {
      var range = Immutable.Range(0, size);
      return range.map(i => range.map(j => getStone(stones, new Point(i, j))));
    },

    /*
     * Attempt to place a stone at (i,j).
     */
    play: function(color, coords) {
      coords = new Point(coords[0], coords[1]);

      if (!inBounds(size, coords))
        throw "Intersection out of bounds";

      if (getStone(stones, coords) != Constants.EMPTY)
        throw "Intersection occupied by existing stone";

      var newBoard = replaceStone(stones, coords, color);
      var neighbors = getAdjacentIntersections(size, coords);
      var neighborColors = Immutable.Map(neighbors.zipWith(n => [n, getStone(newBoard, n)]));
      var opponentColor = (stoneColor, coords) => stoneColor != color && stoneColor != Constants.EMPTY;
      var isDead = group => group.get('liberties') === 0;
      var captured = neighborColors
        .filter(opponentColor)
        .map((val, coord) => getGroup(newBoard, size, coord))
        .valueSeq()
        .filter(isDead);

      // detect suicide
      var newGroup = getGroup(newBoard, size, coords);
      if (captured.isEmpty() && isDead(newGroup))
        captured = Immutable.List([newGroup]);

      newBoard = captured
        .flatMap(g => g.get('stones'))
        .reduce((acc, stone) => replaceStone(acc, stone, Constants.EMPTY), newBoard);

      return createBoard(size, newBoard);
    },

    areaScore: function() {
      var positions = allPositions(size);
      var visited = Immutable.Set();
      var score = {};
      score[Constants.BLACK] = 0;
      score[Constants.WHITE] = 0;

      positions.forEach(function(coords) {
        if (visited.has(coords))
          return;

        var state = getStone(stones, coords);
        var group = getGroup(stones, size, coords);
        var groupStones = group.get('stones');
        var surroundingColors = group.get('surrounding').valueSeq().toSet();

        if (state == Constants.EMPTY) {
          if (surroundingColors.size === 1)
            score[surroundingColors.first()] += groupStones.size;
        } else {
          score[state] += groupStones.size;
        }

        visited = visited.union(groupStones);
      });

      return score;
    }
  };

  return Object.create(Board);
};
