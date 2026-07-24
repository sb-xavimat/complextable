import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  computed,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { StudentGroup } from '../../models/gradebook.models';
import { GradebookStateService } from '../../services/gradebook-state.service';

@Component({
  selector: 'app-gradebook-table',
  standalone: true,
  imports: [NgClass],
  templateUrl: './gradebook-table.component.html',
  styleUrl: './gradebook-table.component.scss',
})
export class GradebookTableComponent implements AfterViewInit {
  protected state = inject(GradebookStateService);

  @ViewChild('topScrollbar') topScrollbarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tableContainer') tableContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('gradebookTable') tableRef!: ElementRef<HTMLTableElement>;
  @ViewChild('topDummy') topDummyRef!: ElementRef<HTMLDivElement>;

  // Geometría de sticky headers: top y height calculados con variables CSS
  headerGeometry = computed(() => {
    const topOffsets: string[] = [];
    const heightValues: string[] = [];
    const cumulativeParts: string[] = [];

    for (const row of this.state.config.topRows) {
      const h = row.lines === 1 ? 'var(--row-height-1line)' : 'var(--row-height-2lines)';
      heightValues.push(h);

      if (cumulativeParts.length === 0) {
        topOffsets.push('0px');
      } else if (cumulativeParts.length === 1) {
        topOffsets.push(cumulativeParts[0]);
      } else {
        topOffsets.push(`calc(${cumulativeParts.join(' + ')})`);
      }
      cumulativeParts.push(h);
    }
    return { topOffsets, heightValues };
  });

  get firstFixedRight(): number {
    return this.state.totalCols() - this.state.config.fixedRightCols;
  }

  emptyCols = computed(() =>
    Array.from({ length: this.state.totalCols() - 1 }, (_, i) => i)
  );

  stickyRightStyle(colIndex: number): string {
    const pos = this.state.totalCols() - 1 - colIndex;
    return pos === 0 ? '0px' : `calc(var(--col-width-default) * ${pos})`;
  }

  ngAfterViewInit(): void {
    this.setupScrollSync();
  }

  private setupScrollSync(): void {
    const topEl       = this.topScrollbarRef.nativeElement;
    const containerEl = this.tableContainerRef.nativeElement;
    const dummyEl     = this.topDummyRef.nativeElement;
    const tableEl     = this.tableRef.nativeElement;

    let isSyncing = false;

    const updateDummyWidth = () => {
      dummyEl.style.width =
        (tableEl.scrollWidth - containerEl.clientWidth + topEl.clientWidth) + 'px';
    };

    const adjustHeight = () => {
      containerEl.style.height =
        tableEl.scrollWidth > containerEl.clientWidth
          ? 'calc(100% + 15px)'
          : '100%';
    };

    const ro = new ResizeObserver(() => { updateDummyWidth(); adjustHeight(); });
    ro.observe(tableEl);
    ro.observe(containerEl);

    topEl.addEventListener('scroll', () => {
      if (isSyncing) { isSyncing = false; return; }
      isSyncing = true;
      containerEl.scrollLeft = topEl.scrollLeft;
    });

    containerEl.addEventListener('scroll', () => {
      if (isSyncing) { isSyncing = false; return; }
      isSyncing = true;
      topEl.scrollLeft = containerEl.scrollLeft;
    });

    window.addEventListener('resize', adjustHeight);
    setTimeout(adjustHeight, 0);
  }

  toggleGroup(index: number): void {
    this.state.toggleGroup(index);
  }

  groupContentRows(group: StudentGroup): (string | number)[][] {
    return group.collapsed ? [] : group.rows;
  }

  toggleIcon(group: StudentGroup): string {
    return group.collapsed
      ? 'assets/imgs/expand_open.svg'
      : 'assets/imgs/expand_close.svg';
  }
}
      return `${base} ${num < 60 ? 'score-fail' : 'score-pass'}`;
    }
    return base;
  }
}
