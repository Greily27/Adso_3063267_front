import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { PeriodosForm } from './components/periodos-form/periodos-form';
import { CreatePeriodoDto, PeriodoModel, UpdatePeriodoDto } from './models/periodo.model';
import { PeriodosService } from './services/periodos-service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-periodos',
  imports: [CommonModule, MatButtonModule, MatDialogModule, CustomTable],
  templateUrl: './periodos.html',
  styleUrl: './periodos.scss',
})
export class Periodos {
  private periodosService = inject(PeriodosService);
  public errorMessage = '';

  public columns: TableColumn[] = [
    { label: 'ID', key: 'idPeriodo' },
    { label: 'Nombre', key: 'nombrePeriodo' },
    { label: 'Fecha inicial', key: 'fechaInicialLabel' },
    { label: 'Fecha final', key: 'fechaFinalLabel' }
  ];

  public periodosForTable = computed(() => this.periodosService.periodos().map(periodo => ({
    ...periodo,
    fechaInicialLabel: this.formatDate(periodo.fechaInicial),
    fechaFinalLabel: this.formatDate(periodo.fechaFinal)
  })));

  constructor(private dialog: MatDialog) {}

  openDialog() {
    const dialogRef = this.dialog.open(PeriodosForm, { width: '500px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const periodoDto: CreatePeriodoDto = this.toDto(result);

        this.errorMessage = '';

        if (this.periodoExists(periodoDto.nombrePeriodo)) {
          this.errorMessage = `Ya existe un periodo llamado "${periodoDto.nombrePeriodo}".`;
          this.showError('Periodo duplicado', this.errorMessage);
          return;
        }

        this.periodosService.createPeriodo(periodoDto).subscribe({
          next: (response: PeriodoModel) => this.showSuccess('Periodo creado', `${this.getPeriodoName(response)} se guardo correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al guardar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo crear el periodo.');
            this.showError('Error al guardar', this.errorMessage);
          }
        });
      }
    });
  }

  handleEdit(periodo: PeriodoModel) {
    const dialogRef = this.dialog.open(PeriodosForm, { width: '500px', data: periodo });

    dialogRef.afterClosed().subscribe(result => {
      if (result && periodo.idPeriodo) {
        const periodoDto: UpdatePeriodoDto = this.toDto(result);

        this.errorMessage = '';

        this.periodosService.updatePeriodo(periodo.idPeriodo, periodoDto).subscribe({
          next: response => this.showSuccess('Periodo actualizado', `${this.getPeriodoName(response)} se actualizó correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar el periodo.');
            this.showError('Error al actualizar', this.errorMessage);
          }
        });
      }
    });
  }

  async handleDelete(periodo: PeriodoModel) {
    if (periodo.idPeriodo !== undefined) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Eliminar periodo',
        text: `Estas seguro de eliminar ${this.getPeriodoName(periodo)}?`,
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#b4232f'
      });

      if (!result.isConfirmed) return;
      this.errorMessage = '';

      this.periodosService.deletePeriodo(periodo.idPeriodo).subscribe({
        next: () => this.showSuccess('Periodo eliminado', 'El periodo se eliminó correctamente.'),
        error: (err: HttpErrorResponse) => {
          console.error('Error al eliminar', err);
          this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar el periodo.');
          this.showError('Error al eliminar', this.errorMessage);
        }
      });
    }
  }

  private toDto(formValue: CreatePeriodoDto): CreatePeriodoDto {
    return {
      nombrePeriodo: formValue.nombrePeriodo.trim(),
      fechaInicial: formValue.fechaInicial,
      fechaFinal: formValue.fechaFinal
    };
  }

  private getPeriodoName(periodo: PeriodoModel) {
    return periodo.nombrePeriodo ?? `Periodo ${periodo.idPeriodo}`;
  }

  private periodoExists(nombre: string) {
    const normalizedName = nombre.toLowerCase().trim();

    return this.periodosService.periodos().some(periodo =>
      this.getPeriodoName(periodo).toLowerCase().trim() === normalizedName
    );
  }

  private formatDate(value: string) {
    if (!value) return '';

    return value.includes('T') ? value.split('T')[0] : value;
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (message) {
      return message;
    }

    return err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback;
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
