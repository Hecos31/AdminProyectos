import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Actividadesusuario } from './actividadesusuario';

describe('Actividadesusuario', () => {
  let component: Actividadesusuario;
  let fixture: ComponentFixture<Actividadesusuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Actividadesusuario],
    }).compileComponents();

    fixture = TestBed.createComponent(Actividadesusuario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
