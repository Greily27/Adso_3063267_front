import { CommonModule } from '@angular/common';
import { Component, effect, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PeriodoModel } from '../../../periodos/models/periodo.model';
import { PeriodosService } from '../../../periodos/services/periodos-service';
import { NotaModel } from '../../models/nota.model';

@Component({
  selector: 'app-notas-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './notas-form.html',
  styleUrl: './notas-form.scss',
})
export class NotasForm {
  private fb = inject(FormBuilder);
  private periodosService = inject(PeriodosService);
  public isEditMode = true;
  public periodos = this.periodosService.periodos;

  public form = this.fb.group({
    valor: [null as number | null, [Validators.required, Validators.min(1), Validators.max(5)]],
    periodo: [null as PeriodoModel | null, Validators.required],
    descripcion: ['']
  });

  constructor(
    private dialogRef: MatDialogRef<NotasForm>,
    @Inject(MAT_DIALOG_DATA) public data: NotaModel
  ) {
    effect(() => {
      if (!this.data || this.form.controls.periodo.value) return;

      const periodo = this.getNotaPeriodo(this.data);
      if (periodo) {
        this.form.controls.periodo.setValue(periodo, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    this.periodosService.loadPeriodos();

    if (!this.data) return;

    this.form.patchValue({
      valor: Number(this.data.valor),
      periodo: this.getNotaPeriodo(this.data),
      descripcion: this.data.descripcion ?? ''
    });
  }

  get canSave() {
    return this.form.controls.valor.valid && this.form.controls.periodo.valid;
  }

  onSave() {
    this.form.controls.valor.markAsTouched();
    this.form.controls.periodo.markAsTouched();

    if (!this.canSave) return;

    const value = this.form.value;
    this.dialogRef.close({
      valor: Number(value.valor),
      periodoId: this.getPeriodoId(value.periodo),
      descripcion: value.descripcion?.trim() || ''
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  comparePeriodo = (item1: PeriodoModel | null, item2: PeriodoModel | null) => {
    return item1 && item2
      ? this.getPeriodoId(item1) === this.getPeriodoId(item2)
      : item1 === item2;
  };

  getPeriodoId(periodo?: PeriodoModel | null) {
    return periodo?.idPeriodo ?? 0;
  }

  formatDate(value?: string | Date | null) {
    if (!value) return 'Sin fecha';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  }

  private getNotaPeriodo(nota: NotaModel) {
    const notaWithPeriodo = nota as NotaModel & {
      periodo?: { idPeriodo?: number; id?: number };
    };
    const periodoId = nota.periodoId
      ?? nota.idPeriodo
      ?? notaWithPeriodo.periodo?.idPeriodo
      ?? notaWithPeriodo.periodo?.id;

    return this.periodos().find(periodo => this.getPeriodoId(periodo) === periodoId) ?? null;
  }
}
