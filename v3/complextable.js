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
const Gradebook = (function () {
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
        this.groups = options.groups;
        this.cellClasses = options.cellClasses || {};
        this.cellClassFn = options.cellClassFn || null;
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
        const topOffsets = [];
        const heightValues = [];
        const cumulativeParts = [];

        for (let r = 0; r < this.config.topRows.length; r++) {
            const rowConfig = this.config.topRows[r];
            const heightVar = (rowConfig.lines === 1)
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
        const thead = document.getElementById(this.els.thead);
        const totalCols = this.headerRows[0].length;
        const fixedRight = this.config.fixedRightCols;
        const firstFixedRightIndex = totalCols - fixedRight;
        const geo = this._calcHeaderGeometry();

        for (let r = 0; r < this.config.topRows.length; r++) {
            const tr = document.createElement('tr');

            for (let c = 0; c < totalCols; c++) {
                const th = document.createElement('th');
                const label = this.headerRows[r][c] || '';

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
                    const posFromRight = (totalCols - 1) - c;
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
        PRIVATE: Create a single <tr> from row data.

        @param {Array}  rowData    - Cell values for each column
        @param {string} [cssClass] - Optional CSS class to add to the <tr>
        @returns {HTMLTableRowElement}
    ---------------------------------------------------------- */
    Gradebook.prototype._makeDataRow = function (rowData, cssClass) {
        const totalCols = this.headerRows[0].length;
        const fixedRight = this.config.fixedRightCols;
        const firstFixedRightIndex = totalCols - fixedRight;

        const tr = document.createElement('tr');
        if (cssClass) { tr.classList.add(cssClass); }

        for (let c = 0; c < totalCols; c++) {
            const td = document.createElement('td');
            const val = rowData[c];
            td.textContent = (val !== undefined && val !== null) ? val : '';

            // Sticky left: column 0
            if (c === 0) {
                td.classList.add('sticky-left');
            }

            // Apply per-column CSS classes (e.g., 'score-cell')
            if (this.cellClasses[c]) {
                td.classList.add(this.cellClasses[c]);
            }

            // Apply value-based CSS class via callback
            if (this.cellClassFn) {
                const extra = this.cellClassFn(c, val);
                if (extra) td.classList.add(extra);
            }

            // Sticky right columns
            if (c >= firstFixedRightIndex) {
                td.classList.add('sticky-right');
                const posFromRight = (totalCols - 1) - c;
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

        return tr;
    };

    /* ----------------------------------------------------------
        PRIVATE: Build <tbody> rows.

        Each group object has { name, rows, averagesRow }. Renders a
        group-name row, student rows, and an averages row per group.

        Uses a DocumentFragment for performance — appending all rows
        in one batch. Each <td> gets the same sticky-left/right logic
        as the header, plus optional CSS classes from this.cellClasses.
    ---------------------------------------------------------- */
    Gradebook.prototype._buildBody = function () {
        const tbody = document.getElementById(this.els.tbody);
        const totalCols = this.headerRows[0].length;
        const fragment = document.createDocumentFragment();
        let g, r, i, group, nameData;

        this._groupElements = [];

        for (let g = 0; g < this.groups.length; g++) {
            group = this.groups[g];

            // Group name row: toggle button + label in col 0, empty elsewhere
            nameData = [];
            for (let i = 0; i < totalCols; i++) {
                nameData.push(i === 0 ? group.name : '');
            }
            const nameRow = this._makeDataRow(nameData, 'group-name-row');

            const firstCell = nameRow.querySelector('td.sticky-left');
            if (firstCell) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'group-toggle-btn';
                btn.setAttribute('data-group', g);
                const img = document.createElement('img');
                img.src = '../imgs/expand_close.svg';
                img.alt = 'Toggle group';
                btn.appendChild(img);
                firstCell.insertBefore(btn, firstCell.firstChild);
            }
            fragment.appendChild(nameRow);

            // Student rows
            const contentRows = [];
            for (let r = 0; r < group.rows.length; r++) {
                const row = this._makeDataRow(group.rows[r]);
                fragment.appendChild(row);
                contentRows.push(row);
            }

            // Group averages row (always visible, never collapsed)
            if (group.averagesRow) {
                fragment.appendChild(this._makeDataRow(group.averagesRow, 'group-averages-row'));
            }

            this._groupElements[g] = {
                nameRow: nameRow,
                contentRows: contentRows,
                collapsed: false
            };
        }

        tbody.appendChild(fragment);
        this._setupGroupToggles();
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
        const topScrollbar = document.getElementById(this.els.topScrollbar);
        const tableContainer = document.getElementById(this.els.tableContainer);
        const topDummy = document.getElementById(this.els.topDummy);
        const table = document.getElementById(this.els.table);

        let isSyncing = false;

        // ResizeObserver: keep the dummy div width in sync with the table's scrollWidth,
        // accounting for the vertical scrollbar width (difference between
        // tableContainer.clientWidth and topScrollbar.clientWidth).
        function updateDummyWidth() {
            topDummy.style.width = (table.scrollWidth - tableContainer.clientWidth + topScrollbar.clientWidth) + 'px';
        }
        const resizeObserver = new ResizeObserver(function () {
            updateDummyWidth();
        });
        resizeObserver.observe(table);
        resizeObserver.observe(tableContainer);

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
    };

    /* ----------------------------------------------------------
        PRIVATE: Attach click handlers to all group toggle buttons.
    ---------------------------------------------------------- */
    Gradebook.prototype._setupGroupToggles = function () {
        const self = this;
        const buttons = document.querySelectorAll('.group-toggle-btn');
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                const groupIndex = parseInt(this.getAttribute('data-group'), 10);
                self._toggleGroup(groupIndex);
            });
        }
    };

    /* ----------------------------------------------------------
        PRIVATE: Toggle a group between collapsed and revealed.
        Hides/shows student and averages rows, swaps SVG icon.
    ---------------------------------------------------------- */
    Gradebook.prototype._toggleGroup = function (groupIndex) {
        const groupData = this._groupElements[groupIndex];
        if (!groupData) return;

        groupData.collapsed = !groupData.collapsed;

        const img = groupData.nameRow.querySelector('.group-toggle-btn img');

        for (let i = 0; i < groupData.contentRows.length; i++) {
            groupData.contentRows[i].style.display = groupData.collapsed ? 'none' : '';
        }

        if (img) {
            img.src = groupData.collapsed ? '../imgs/expand_open.svg' : '../imgs/expand_close.svg';
        }
    };

    /* ----------------------------------------------------------
        PRIVATE: Update footer with row/column counts (optional).
    ---------------------------------------------------------- */
    Gradebook.prototype._updateFooter = function () {
        if (!this.els.footerInfo) return;
        const el = document.getElementById(this.els.footerInfo);
        if (!el) return;
        const totalCols = this.headerRows[0].length;
        let studentCount = 0;
        for (let g = 0; g < this.groups.length; g++) {
            studentCount += this.groups[g].rows.length;
        }
        el.textContent = studentCount + ' Students \u2022 ' + totalCols + ' Columns';
    };

    return Gradebook;
})();

