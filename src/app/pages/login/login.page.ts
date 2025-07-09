import { Component, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private navCtrl = inject(NavController);
  private toastController = inject(ToastController);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  async login() {
    if (this.form.invalid) {
      this.presentToast('Completa todos los campos');
      return;
    }

    const { email, password } = this.form.value;

    try {
      await this.authService.login(email, password);
      this.navCtrl.navigateRoot('/products');
    } catch (e) {
      this.presentToast('Credenciales inválidas');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color: 'danger',
    });
    toast.present();
  }
  goToRegister() {
    this.navCtrl.navigateForward('/register');
  }
}
