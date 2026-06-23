import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { CreateUserDto, UpdateUserDto, UserModel } from './models/user.model';
import { UsersComponent } from './components/users-component/users-component';
import { UsersService } from './services/users-service';
import { Auth } from '../../core/services/auth';
import { buildCreateUserDto, buildUpdateUserDto } from './utils/user-dto.mapper';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users',
  imports: [CommonModule, MatButtonModule, MatDialogModule, CustomTable],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  private usersService = inject(UsersService);
  private authService = inject(Auth);

  public columns: TableColumn[] = [
    { label: 'ID', key: 'id' },
    { label: 'Nombres', key: 'names' },
    { label: 'Apellidos', key: 'lastNames' },
    { label: 'Teléfono', key: 'phone' },
    { label: 'Dirección', key: 'address' },
    { label: 'Tipo Documento', key: 'docType' },
    { label: 'Numero Documento', key: 'document' },
    { label: 'Correo', key: 'email' },
    { label: 'Estado', key: 'status' },
    { label: 'Roles', key: 'rolesList' },
    { label: 'Materias', key: 'materiasList' }
  ];

  public usersForTable = computed(() => this.usersService.users().map(user => ({
    ...user,
    status: user.isActive ? 'Activo' : 'Inactivo',
    rolesList: user.roles.map(role => role.name).join(', ') || 'Sin roles',
    materiasList: this.getMateriasList(user)
  })));

  constructor(private dialog: MatDialog) {}

  openDialog() {
    const dialogRef = this.dialog.open(UsersComponent, {
      width: '820px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const userDto: CreateUserDto = buildCreateUserDto(result);
        console.log('Payload enviado a usuarios:', userDto);

        this.usersService.createUser(userDto, result.roles, result.materias).subscribe({
          next: (response: UserModel) => {
            Swal.fire({
              icon: 'success',
              title: 'Usuario creado',
              text: `${response.names} ${response.lastNames} se guardo correctamente.`,
              confirmButtonText: 'Aceptar'
            });
          },
          error: (err: HttpErrorResponse) => {
            Swal.fire({
              icon: 'error',
              title: 'Error al guardar',
              text: this.getErrorMessage(err),
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  handleEdit(user: UserModel) {
    if (user.id) {
      this.usersService.getUserById(user.id).subscribe({
        next: completeUser => this.openEditDialog(completeUser),
        error: () => this.openEditDialog(user)
      });
    }
  }

  private openEditDialog(user: UserModel) {
    const dialogRef = this.dialog.open(UsersComponent, {
      width: '820px',
      maxWidth: '95vw',
      data: user
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && user.id) {
        const userDto: UpdateUserDto = buildUpdateUserDto(result);
        console.log('Payload enviado a usuarios:', userDto);

        this.usersService.updateUser(user.id, userDto, result.roles, result.materias).subscribe({
          next: response => {
            const updatedUser: UserModel = {
              ...user,
              ...response,
              roles: response.roles ?? result.roles,
              materias: response.materias?.length ? response.materias : result.materias
            };

            this.authService.updateLocalUser(updatedUser);
            Swal.fire({
              icon: 'success',
              title: 'Usuario actualizado',
              text: `${updatedUser.names} ${updatedUser.lastNames} se actualizó correctamente.`,
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#146b50'
            });
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            Swal.fire({
              icon: 'error',
              title: 'Error al actualizar',
              text: this.getErrorMessage(err, 'No se pudo actualizar el usuario.'),
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#b4232f'
            });
          }
        });
      }
    });
  }

  async handleDelete(user: UserModel) {
    if (user.id === undefined) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar usuario',
      text: `Estas seguro de eliminar a ${user.names}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.usersService.deleteUser(user.id).subscribe({
      next: () => Swal.fire({
        icon: 'success',
        title: 'Usuario eliminado',
        text: 'El usuario se eliminó correctamente.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#146b50'
      }),
      error: (err: HttpErrorResponse) => {
        console.error('Error al eliminar', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al eliminar',
          text: this.getErrorMessage(err, 'No se pudo eliminar el usuario.'),
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#b4232f'
        });
      }
    });
  }

  private getErrorMessage(err: HttpErrorResponse, fallback = 'No se pudo crear el usuario.') {
    const message = err.error?.message;

    return Array.isArray(message)
      ? message.join(', ')
      : message || fallback;
  }

  private getMateriasList(user: UserModel) {
    const materias = user.materias ?? [];

    if (materias.length === 0) {
      return 'Sin materias';
    }

    return materias
      .map(materia => {
        const materiaValue = materia as typeof materia & { nombre?: string; name?: string; id?: number };
        return materiaValue.nombreMateria || materiaValue.nombre || materiaValue.name || `Materia ${materiaValue.idMateria ?? materiaValue.id}`;
      })
      .join(', ');
  }

}
