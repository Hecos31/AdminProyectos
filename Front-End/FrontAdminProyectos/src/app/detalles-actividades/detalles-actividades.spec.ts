import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetallesActividades } from './detalles-actividades';

describe('DetallesActividades', () => {
  let component: DetallesActividades;
  let fixture: ComponentFixture<DetallesActividades>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallesActividades],
    }).compileComponents();

    fixture = TestBed.createComponent(DetallesActividades);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
