/**
 * ================================================================
 * Gradebook — Reusable Table Builder Class
 * ================================================================
 *
 * A generic, data-agnostic class that renders a sticky-header,
 * sticky-column table with a synced top scrollbar.
 *
 * It knows NOTHING about students, grades, or any domain concept.
 * It only understands:
 *   - headerRows: arrays of label strings (one per header row)
 *   - bodyRows:   arrays of cell values (one per data row)
 *   - config:     structural info (topRows line counts, fixedRightCols)
 *   - cellClasses: optional per-column CSS class arrays for body cells
 *
 * All sticky offsets are built from CSS variable math — no DOM measurement.
 */
var Gradebook = (function () {
    'use strict';

    /**
     * @constructor
     * @param {Object} options
     * @param {Object} options.config - Structural configuration
     * @param {Array}  options.config.topRows - Array of { lines: 1|2 } row descriptors
     * @param {number} options.config.fixedRightCols - Number of sticky-right columns
     * @param {Array<Array<string>>} options.headerRows - One string[] per header row
     * @param {Array<Array<string|number>>} options.bodyRows - One array per data row
     * @param {Object} [options.cellClasses] - Map of column index → CSS class name(s) for body cells
     * @param {Object} options.elements - DOM element IDs
     * @param {string} options.elements.thead - ID of the <thead> element
     * @param {string} options.elements.tbody - ID of the <tbody> element
     * @param {string} options.elements.topScrollbar - ID of the top scrollbar container
     * @param {string} options.elements.topDummy - ID of the top scrollbar dummy div
     * @param {string} options.elements.tableContainer - ID of the table scroll container
     * @param {string} options.elements.table - ID of the <table> element
     * @param {string} [options.elements.footerInfo] - ID of the footer info span (optional)
     */
    function Gradebook(options) {
    this.config = options.config;
    this.headerRows = options.headerRows;
    this.bodyRows = options.bodyRows;
    this.cellClasses = options.cellClasses || {};
    this.els = options.elements;
    }

    /**
     * Render the full table (headers + body) and set up scroll sync.
     */
    Gradebook.prototype.render = function () {
    this._buildHead();
    this._buildBody();
    this._setupScrollSync();
    this._updateFooter();
    };

    /* ----------------------------------------------------------
        PRIVATE: Pre-calculate TOP offsets and HEIGHTS for header rows.

        We build arrays of CSS value strings, NOT pixel numbers.
        This way the offsets stay in sync with the CSS variables,
        and no runtime DOM measurement is required.
    ---------------------------------------------------------- */
    Gradebook.prototype._calcHeaderGeometry = function () {
    var topOffsets = [];
    var heightValues = [];
    var cumulativeParts = [];

    for (var r = 0; r < this.config.topRows.length; r++) {
        var rowConfig = this.config.topRows[r];
        var heightVar = (rowConfig.lines === 1)
        ? 'var(--row-height-1line)'
        : 'var(--row-height-2lines)';

        heightValues.push(heightVar);

        if (r === 0) {
        topOffsets.push('0px');
        } else if (cumulativeParts.length === 1) {
        topOffsets.push(cumulativeParts[0]);
        } else {
        topOffsets.push('calc(' + cumulativeParts.join(' + ') + ')');
        }

        cumulativeParts.push(heightVar);
    }

    return { topOffsets: topOffsets, heightValues: heightValues };
    };

    /* ----------------------------------------------------------
        PRIVATE: Build <thead> rows.

        For each header row defined in config.topRows, we create a
        <tr> and populate it with <th> cells. Each <th> gets:
        - Inline `top` and `height` styles (CSS variable math)
        - Class `sticky-left` if it's column 0
        - Class `sticky-right` + inline `right` offset if it's a fixed-right column
    ---------------------------------------------------------- */
    Gradebook.prototype._buildHead = function () {
    var thead = document.getElementById(this.els.thead);
    var totalCols = this.headerRows[0].length;
    var fixedRight = this.config.fixedRightCols;
    var firstFixedRightIndex = totalCols - fixedRight;
    var geo = this._calcHeaderGeometry();

    for (var r = 0; r < this.config.topRows.length; r++) {
        var tr = document.createElement('tr');

        for (var c = 0; c < totalCols; c++) {
        var th = document.createElement('th');
        var label = this.headerRows[r][c] || '';

        // Multi-line content (e.g. "\n" in sub-header rows)
        if (label.indexOf('\n') !== -1) {
            th.innerHTML = label.replace('\n', '<br>');
            if (r > 0) th.classList.add('sub-header');
        } else {
            th.textContent = label;
            if (r > 0) th.classList.add('sub-header');
        }

        // Sticky top: inline CSS variable math
        th.style.top = geo.topOffsets[r];
        th.style.height = geo.heightValues[r];

        // Sticky left: column 0
        if (c === 0) {
            th.classList.add('sticky-left');
        }

        // Sticky right: last N columns
        if (c >= firstFixedRightIndex) {
            th.classList.add('sticky-right');
            var posFromRight = (totalCols - 1) - c;
            th.style.right = (posFromRight === 0)
            ? '0px'
            : 'calc(var(--col-width-default) * ' + posFromRight + ')';
        }

        // Fixed width for non-name columns
        if (c !== 0) {
            th.style.width = 'var(--col-width-default)';
            th.style.minWidth = 'var(--col-width-default)';
            th.style.maxWidth = 'var(--col-width-default)';
        }

        tr.appendChild(th);
        }

        thead.appendChild(tr);
    }
    };

    /* ----------------------------------------------------------
        PRIVATE: Build <tbody> rows.

        Uses a DocumentFragment for performance — appending all rows
        in one batch. Each <td> gets the same sticky-left/right logic
        as the header, plus optional CSS classes from this.cellClasses.
    ---------------------------------------------------------- */
    Gradebook.prototype._buildBody = function () {
    var tbody = document.getElementById(this.els.tbody);
    var totalCols = this.headerRows[0].length;
    var fixedRight = this.config.fixedRightCols;
    var firstFixedRightIndex = totalCols - fixedRight;
    var fragment = document.createDocumentFragment();

    for (var r = 0; r < this.bodyRows.length; r++) {
        var tr = document.createElement('tr');

        for (var c = 0; c < totalCols; c++) {
        var td = document.createElement('td');
        td.textContent = this.bodyRows[r][c];

        // Sticky left: column 0
        if (c === 0) {
            td.classList.add('sticky-left');
        }

        // Apply per-column CSS classes (e.g., 'score-cell', 'grade-cell')
        if (this.cellClasses[c]) {
            td.classList.add(this.cellClasses[c]);
        }

        // Sticky right columns
        if (c >= firstFixedRightIndex) {
            td.classList.add('sticky-right');
            var posFromRight = (totalCols - 1) - c;
            td.style.right = (posFromRight === 0)
            ? '0px'
            : 'calc(var(--col-width-default) * ' + posFromRight + ')';
        }

        // Fixed width for non-name columns
        if (c !== 0) {
            td.style.width = 'var(--col-width-default)';
            td.style.minWidth = 'var(--col-width-default)';
            td.style.maxWidth = 'var(--col-width-default)';
        }

        tr.appendChild(td);
        }

        fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    };

    /* ----------------------------------------------------------
        PRIVATE: Scroll synchronization between top scrollbar
        and table container.

        ANTI-INFINITE-LOOP FLAG:
        Setting `element.scrollLeft = value` fires a 'scroll' event.
        Without protection, this creates an infinite loop.
        A shared `isSyncing` flag breaks the loop.
    ---------------------------------------------------------- */
    Gradebook.prototype._setupScrollSync = function () {
    var topScrollbar = document.getElementById(this.els.topScrollbar);
    var tableContainer = document.getElementById(this.els.tableContainer);
    var topDummy = document.getElementById(this.els.topDummy);
    var table = document.getElementById(this.els.table);

    var isSyncing = false;

    // ResizeObserver: keep the dummy div width in sync with the table's scrollWidth
    var resizeObserver = new ResizeObserver(function () {
        topDummy.style.width = table.scrollWidth + 'px';
        adjustTableContainerHeight();
    });
    resizeObserver.observe(table);

    // Sync: Top Scrollbar → Table Container
    topScrollbar.addEventListener('scroll', function () {
        if (isSyncing) { isSyncing = false; return; }
        isSyncing = true;
        tableContainer.scrollLeft = topScrollbar.scrollLeft;
    });

    // Sync: Table Container → Top Scrollbar
    tableContainer.addEventListener('scroll', function () {
        if (isSyncing) { isSyncing = false; return; }
        isSyncing = true;
        topScrollbar.scrollLeft = tableContainer.scrollLeft;
    });

    // Dynamically adjust .table-container height to avoid clipping last row when no horizontal scrollbar
    function adjustTableContainerHeight() {
        if (!containerOrTableReady()) return;
        if (table.scrollWidth > tableContainer.clientWidth) {
            tableContainer.style.height = 'calc(100% + 15px)';
        } else {
            tableContainer.style.height = '100%';
        }
    }
    function containerOrTableReady() {
        return tableContainer && table;
    }
    window.addEventListener('resize', adjustTableContainerHeight);
    setTimeout(adjustTableContainerHeight, 0);
    };

    /* ----------------------------------------------------------
        PRIVATE: Update footer with row/column counts (optional).
    ---------------------------------------------------------- */
    Gradebook.prototype._updateFooter = function () {
    if (!this.els.footerInfo) return;
    var el = document.getElementById(this.els.footerInfo);
    if (!el) return;
    var totalCols = this.headerRows[0].length;
    el.textContent = this.bodyRows.length + ' Students \u2022 ' + totalCols + ' Columns';
    };

    return Gradebook;
})();

