
# 🛒 Reto Técnico - App Móvil de Compras (Ionic + Angular)

Este proyecto es una aplicación móvil desarrollada con **Ionic Framework** y **Angular**, que simula una experiencia de compra básica con autenticación, listado de productos, carrito y detalle del pedido.

---

## 🚀 Tecnologías Utilizadas

- **Ionic Framework** – Interfaz multiplataforma.
- **Angular** – Framework web moderno.
- **Firebase Authentication** – Inicio de sesión con JWT.
- **Firebase Firestore** – Base de datos en tiempo real.
- **SQLite (via Capacitor)** – Persistencia local del carrito.
- **Capacitor** – Plugins nativos para funcionalidades móviles.
- **Push Notifications (opcional)** – Usando Firebase.

---

## 📲 Funcionalidades

1. **Login**  
   Autenticación de usuarios usando Firebase (JWT).

2. **Listado de productos**  
   Productos obtenidos desde Firebase Firestore, cada uno incluye:
   - Imagen
   - Valor
   - Descripción

3. **Carrito de compras**  
   Carrito persistente utilizando SQLite local.

4. **Detalle del pedido**  
   Vista resumen con todos los productos seleccionados.

5. **Simulación de pedido exitoso**  
   Todos los pedidos se completan con éxito de forma simulada.

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── login/                # Módulo de autenticación
│   ├── product-list/            # Módulo de productos
│   ├── cart/                # Módulo del carrito (persistencia con SQLite)
│   └── order-detail/               # Módulo del detalle del pedido
├── assets/
└── environments/
```

---

## 🛠️ Instalación y Ejecución

### 1. Clona el repositorio

```bash
git clone https://github.com/tu-usuario/ionic-ecommerce-app.git
cd ionic-ecommerce-app
```

### 2. Instala dependencias

```bash
npm install
```

### 3. Configura Firebase

Reemplaza el contenido de `src/environments/environment.ts` con tus credenciales de Firebase.

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: "xxx",
    authDomain: "xxx.firebaseapp.com",
    projectId: "xxx",
    storageBucket: "xxx.appspot.com",
    messagingSenderId: "xxx",
    appId: "xxx"
  }
};
```

### 4. Ejecuta la aplicación

```bash
ionic serve
```

Para emulador nativo:

```bash
ionic cap add android
ionic cap open android
```

---

## 📦 Scripts y Datos de Prueba

Incluye un script o instrucciones para poblar la base de datos con productos de prueba en Firestore (ver carpeta `/firebase/scripts/` si aplica).

---

## ✅ Buenas Prácticas Implementadas

- Principios **SOLID** y **Clean Code**.
- Seguridad con **JWT** y sanitización de entradas.
- **Persistencia offline** usando SQLite.
- Optimización de rendimiento en dispositivos móviles (lazy loading, compresión de assets).
- Manejo de estados y navegación fluida.
- (Opcional) Uso de **gestos** y **animaciones personalizadas** para mejorar la experiencia.

---

## 🎥 Video Demostrativo

📽️ Enlace al video (3-5 minutos) mostrando funcionalidades clave y explicaciones de arquitectura y código:  
https://youtu.be/ejemplo-demo-video

---

## 📄 PDF Adjunto

- Explicación de arquitectura y decisiones técnicas.
- Guía paso a paso de instalación y ejecución.
- Justificación del stack tecnológico.
