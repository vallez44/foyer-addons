/* Foyer: tile sizes and grid placement, shared by the iPad page, the settings page and the server. ES5. */
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

  function sizeOf(tile, cols, rows) {
    var s = SIZES[tile && tile.size] || SIZES.S;
    return [Math.min(s[0], cols), Math.min(s[1], rows)];
  }

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

  /** Places tiles in order, each in the first free spot (row by row). Tiles that do not fit are left out. */
  function place(tiles, cols, rows) {
    var grid = [];
    var r, c, i;
    for (r = 0; r < rows; r++) {
      grid.push([]);
      for (c = 0; c < cols; c++) grid[r].push(false);
    }
    var out = [];
    for (i = 0; i < tiles.length; i++) {
      var sz = sizeOf(tiles[i], cols, rows);
      var w = sz[0];
      var h = sz[1];
      var done = false;
      for (var y = 0; y <= rows - h && !done; y++) {
        for (var x = 0; x <= cols - w && !done; x++) {
          if (fits(grid, x, y, w, h)) {
            mark(grid, x, y, w, h);
            out.push({ tile: tiles[i], index: i, x: x, y: y, w: w, h: h });
            done = true;
          }
        }
      }
    }
    return out;
  }

  return { SIZES: SIZES, SIZE_NAMES: SIZE_NAMES, GRIDS: GRIDS, gridFor: gridFor, place: place };
}));
