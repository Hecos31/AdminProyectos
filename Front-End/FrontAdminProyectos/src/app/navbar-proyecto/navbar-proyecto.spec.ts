import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarProyecto } from './navbar-proyecto';

describe('NavbarProyecto', () => {
  let component: NavbarProyecto;
  let fixture: ComponentFixture<NavbarProyecto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarProyecto],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarProyecto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
