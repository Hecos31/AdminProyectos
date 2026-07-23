import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Crearactividades } from './crearactividades';

describe('Crearactividades', () => {
  let component: Crearactividades;
  let fixture: ComponentFixture<Crearactividades>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Crearactividades],
    }).compileComponents();

    fixture = TestBed.createComponent(Crearactividades);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
