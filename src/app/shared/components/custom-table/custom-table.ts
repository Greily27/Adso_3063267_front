import { ChangeDetectorRef, Component, Input, OnInit, ViewChild, AfterViewInit, EventEmitter, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';

export interface TableColumn {
  label: string; // Título de la columna (ej: 'Descripción')
  key: string;   // Propiedad del objeto (ej: 'description')
}

@Component({
  selector: 'app-custom-table',
  imports: [
    CommonModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule
  ],
  templateUrl: './custom-table.html',
  styleUrl: './custom-table.scss',
})
export class CustomTable <T> implements OnInit, AfterViewInit, OnChanges {

  @Input() columns: TableColumn[] = []; 
  @Input() showActions = true;
  // Usamos un setter para actualizar el DataSource automáticamente cuando cambien los datos
  @Input() set data(value: T[]) {
    setTimeout(() => {
      this.dataSource.data = value ?? [];
      this.cdr.detectChanges();
    });
  }

  @Output() edit = new EventEmitter<T>();
  @Output() delete = new EventEmitter<T>();

  public dataSource = new MatTableDataSource<T>([]);
  public displayedColumns: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.updateDisplayedColumns();
  }

  ngOnChanges() {
    this.updateDisplayedColumns();
  }

  private updateDisplayedColumns() {
    this.displayedColumns = this.showActions
      ? [...this.columns.map(col => col.key), 'actions']
      : this.columns.map(col => col.key);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.cdr.detectChanges();
    });
  }

  onEdit(item: T) {
    this.edit.emit(item);
  }

  onDelete(item: T) {
    this.delete.emit(item);
  }
}
