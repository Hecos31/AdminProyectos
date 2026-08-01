import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmacionModal } from './confirmacion-modal';

describe('ConfirmacionModal', () => {
  let component: ConfirmacionModal;
  let fixture: ComponentFixture<ConfirmacionModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmacionModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacionModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
