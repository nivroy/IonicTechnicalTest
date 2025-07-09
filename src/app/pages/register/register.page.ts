import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss']
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private navCtrl = inject(NavController);
  private toastController = inject(ToastController);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required]
  });

  async register() {
    if (this.form.invalid) {
      this.presentToast('Completa todos los campos');
      return;
    }

    const { email, password, confirmPassword } = this.form.value;
    if (password !== confirmPassword) {
      this.presentToast('Las contraseñas no coinciden');
      return;
    }

    try {
      await this.authService.register(email, password);
      this.navCtrl.navigateRoot('/');
    } catch {
      this.presentToast('Error al registrar');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color: 'danger',
    });
    toast.present();
  }}
