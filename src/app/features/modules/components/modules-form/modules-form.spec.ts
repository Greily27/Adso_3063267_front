import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModulesForm } from './modules-form';

describe('ModulesForm', () => {
  let component: ModulesForm;
  let fixture: ComponentFixture<ModulesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModulesForm],
    }).compileComponents();

    fixture = TestBed.createComponent(ModulesForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
