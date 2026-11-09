/* Foyer: tile sizes and grid placement, shared by the iPad page and the server. ES5. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FOYER_LAYOUT = factory();
}(this, function () {
  var SIZES = { S: [1, 1], W: [2, 1], T: [1, 2], M: [2, 2], L: [3, 2], XL: [4, 2] };
  var SIZE_NAMES = { S: 'Petite', W: 'Large', T: 'Haute', M: 'Moyenne', L: 'Grande', XL: 'Très grande' };
  var GRIDS = {
    home_plus: { landscape: [7, 4], portrait: [4, 7] },
    home: { landscape: [4, 3], portrait: [3, 4] }
  };

  function gridFor(face, landscape) {
    var g = GRIDS[face] || GRIDS.home;
    return landscape ? g.landscape : g.portrait;
  }

  function keyFor(landscape) { return landscape ? 'l' : 'p'; }

  function sizeOf(tile, cols, rows) {
    var s = SIZES[tile && tile.size] || SIZES.S;
    return [Math.min(s[0], cols), Math.min(s[1], rows)];
  }

  function isInt(v) { return typeof v === 'number' && v % 1 === 0; }

  function fits(grid, x, y, w, h) {
    for (var r = y; r < y + h; r++) {
      for (var c = x; c < x + w; c++) {
        if (grid[r][c]) return false;
      }
    }
    return true;
  }

  function mark(grid, x, y, w, h) {
    for (var r = y; r < y + h; r++) {
      for (var c = x; c < x + w; c++) grid[r][c] = true;
    }
  }

  function emptyGrid(cols, rows) {
    var grid = [];
    for (var r = 0; r < rows; r++) {
      grid.push([]);
      for (var c = 0; c < cols; c++) grid[r].push(false);
    }
    return grid;
  }

  /** First free spot (row by row) for a w×h tile, or null. */
  function firstFit(grid, cols, rows, w, h) {
    for (var y = 0; y <= rows - h; y++) {
      for (var x = 0; x <= cols - w; x++) {
        if (fits(grid, x, y, w, h)) return [x, y];
      }
    }
    return null;
  }

  /**
   * Places tiles on a cols×rows grid. Tiles pinned for this orientation (tile.pos[key] = [x, y], set when
   * arranging on the screen) keep their cell; the others take the first free spot, row by row, in order.
   * Tiles that do not fit are left out.
   */
  function place(tiles, cols, rows, key) {
    var grid = emptyGrid(cols, rows);
    var out = [];
    var done = [];
    var i;
    var sz;
    if (key) {
      for (i = 0; i < tiles.length; i++) {
        var pos = tiles[i] && tiles[i].pos && tiles[i].pos[key];
        if (!pos || !isInt(pos[0]) || !isInt(pos[1])) continue;
        sz = sizeOf(tiles[i], cols, rows);
        if (pos[0] < 0 || pos[1] < 0 || pos[0] + sz[0] > cols || pos[1] + sz[1] > rows) continue;
        if (!fits(grid, pos[0], pos[1], sz[0], sz[1])) continue;
        mark(grid, pos[0], pos[1], sz[0], sz[1]);
        out.push({ tile: tiles[i], index: i, x: pos[0], y: pos[1], w: sz[0], h: sz[1] });
        done[i] = true;
      }
    }
    for (i = 0; i < tiles.length; i++) {
      if (done[i]) continue;
      sz = sizeOf(tiles[i], cols, rows);
      var spot = firstFit(grid, cols, rows, sz[0], sz[1]);
      if (!spot) continue;
      mark(grid, spot[0], spot[1], sz[0], sz[1]);
      out.push({ tile: tiles[i], index: i, x: spot[0], y: spot[1], w: sz[0], h: sz[1] });
    }
    return out;
  }

  return {
    SIZES: SIZES, SIZE_NAMES: SIZE_NAMES, GRIDS: GRIDS, gridFor: gridFor, keyFor: keyFor,
    place: place, emptyGrid: emptyGrid, firstFit: firstFit, fits: fits, mark: mark
  };
}));
