import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular
} from '@ionic/angular/standalone';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import {
  initializeApp,
  provideFirebaseApp,
  getApp // 👈 NECESARIO
} from '@angular/fire/app';

import {
  provideAuth
} from '@angular/fire/auth';

import {
  provideFirestore,
  getFirestore
} from '@angular/fire/firestore';

import {
  initializeAuth,
  browserLocalPersistence
} from 'firebase/auth'; // 👈 Import desde Firebase JS SDK

import './registerIonicons';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideFirebaseApp(() =>
      initializeApp({
        projectId: 'ionic-test-6d21d',
        appId: '1:936983730494:web:ac5502751f4474a59c746f',
        storageBucket: 'ionic-test-6d21d.firebasestorage.app',
        apiKey: 'AIzaSyAmvVFwa5udxq0oO2vAboY9awCd0TF__UQ',
        authDomain: 'ionic-test-6d21d.firebaseapp.com',
        messagingSenderId: '936983730494',
        measurementId: 'G-6TL7944DQK',
      })
    ),

    provideAuth(() =>
      initializeAuth(getApp(), {
        persistence: browserLocalPersistence,
      })
    ),

    provideFirestore(() => getFirestore()),
  ],
});
