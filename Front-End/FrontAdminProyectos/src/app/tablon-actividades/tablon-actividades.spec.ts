import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablonActividades } from './tablon-actividades';

describe('TablonActividades', () => {
  let component: TablonActividades;
  let fixture: ComponentFixture<TablonActividades>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablonActividades],
    }).compileComponents();

    fixture = TestBed.createComponent(TablonActividades);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
