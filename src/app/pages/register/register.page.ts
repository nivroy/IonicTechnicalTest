import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { NavController, ToastController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private navCtrl: NavController,
    private toastCtrl: ToastController
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async register() {
    const { email, password } = this.registerForm.value;

    try {
      await this.afAuth.createUserWithEmailAndPassword(email, password);
      const toast = await this.toastCtrl.create({
        message: 'Usuario registrado con éxito',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      this.navCtrl.navigateRoot('/home');
    } catch (error: any) {
      const toast = await this.toastCtrl.create({
        message: error.message || 'Error en el registro',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }
}
