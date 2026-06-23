import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-not-found',
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './page-not-found.html',
  styleUrl: './page-not-found.scss',
})
export class PageNotFound {}
