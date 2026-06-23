import { TestBed } from '@angular/core/testing';

import { Modules } from './modules';

describe('Modules', () => {
  let service: Modules;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Modules);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
