# Conversation Examples — All Paths

Every possible interaction with the bot, from admin onboarding to customer messages to post-onboarding commands.

---

## Path 1: Admin Registration + Full Onboarding (Happy Path)

The admin already has the invite code (received via email, in person, etc.).

---

**📱 Admin (first message ever):**

> REST-A7X9

**🤖 Bot:**

> ✅ ¡Registro exitoso! Vamos a configurar tu negocio paso a paso.
>
> **Paso 1 de 8** — ¿Cuál es el nombre de tu negocio?

---

**📱 Admin:**

> Pizza Express

**🤖 Bot:**

> ✅ Nombre guardado: *Pizza Express*
>
> **Paso 2 de 8** — ¿Cuál es tu horario de atención?
> Ej: Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00

---

**📱 Admin:**

> abrimos de lunes a viernes de 11 de la mañana a 11 de la noche y sabados de 12 del mediodia hasta las 12 de la noche

**🤖 Bot (AI normalises):**

> ✅ Horario guardado:
> *Lun-Vie 11:00-23:00, Sáb 12:00-00:00*
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí el horario de nuevo.

---

**📱 Admin:**

> si

**🤖 Bot:**

> **Paso 3 de 8** — ¿Cómo entregás los pedidos?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local
> 3️⃣ Ambos

---

**📱 Admin:**

> 3

**🤖 Bot:**

> ¿Cuál es la dirección de tu local? (para retiro en local)

---

**📱 Admin:**

> Av. Corrientes 1234, CABA

**🤖 Bot:**

> ✅ Configuración de entrega guardada:
> • 🚚 Delivery: Sí
> • 🏪 Retiro en local: Sí
> • 📍 Dirección: Av. Corrientes 1234, CABA
>
> **Paso 4 de 8** — ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

---

**📱 Admin:**

> 3

**🤖 Bot:**

> ✅ Métodos de pago guardados: *Efectivo y Transferencia*
>
> **Paso 5 de 8** — Escribí tus zonas de delivery con el precio de cada una.
> Ej: Centro $500, Norte $800, Macrocentro $600

---

**📱 Admin:**

> centro 500 pesos, almagro 600, caballito 800 y flores mil pesos

**🤖 Bot (AI parses):**

> ✅ Zonas de delivery guardadas:
> • Centro — $500
> • Almagro — $600
> • Caballito — $800
> • Flores — $1000
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí las zonas de nuevo.

---

**📱 Admin:**

> si

**🤖 Bot:**

> **Paso 6 de 8** — Necesito tus datos bancarios para los cobros:
> • Alias
> • CBU/CVU
> • Titular de la cuenta

---

**📱 Admin:**

> el alias es pizza.express.mp, el cbu 0000003100092810733816 y el titular es Juan Carlos Pérez

**🤖 Bot (AI extracts):**

> ✅ Datos bancarios guardados:
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí los datos de nuevo.

---

**📱 Admin:**

> si

**🤖 Bot:**

> **Paso 7 de 8** — Ahora vamos a cargar tu menú.
> Describí tus productos y yo los organizo.
> Ej: "Pizza Muzzarella grande $5500, muzzarella y salsa de tomate, categoría Pizzas"
>
> Cuando termines, escribí *LISTO*.

---

**📱 Admin:**

> Pizza muzzarella grande 5500 pesos es una pizza con muzza y salsa va en pizzas. También pizza napolitana grande 6200 con tomate muzza y ajo, también en pizzas

**🤖 Bot (AI extracts):**

> ✅ Guardé 2 productos:
> • Pizza Muzzarella — $5500 (Pizzas) ✔️
> • Pizza Napolitana — $6200 (Pizzas) ✔️
>
> Seguí agregando o escribí *LISTO*.

---

**📱 Admin:**

> empanadas de carne x6 por 4200 pesos categoría empanadas. Coca cola 1.5 litros 2000 pesos en bebidas. Flan con dulce de leche 3000 en postres

**🤖 Bot (AI extracts):**

> ✅ Guardé 3 productos:
> • Empanadas de Carne x6 — $4200 (Empanadas) ✔️
> • Coca-Cola 1.5L — $2000 (Bebidas) ✔️
> • Flan con Dulce de Leche — $3000 (Postres) ✔️
>
> Tu menú tiene 5 productos. Seguí agregando o escribí *LISTO*.

---

**📱 Admin:**

> LISTO

**🤖 Bot:**

> 📋 **Paso 8 de 8 — Resumen de tu negocio:**
>
> 🏪 *Pizza Express*
> ⏰ Lun-Vie 11:00-23:00, Sáb 12:00-00:00
> 📍 Av. Corrientes 1234, CABA
> 🚚 Delivery: Centro $500 · Almagro $600 · Caballito $800 · Flores $1000
> 💳 Pagos: Efectivo y Transferencia
> 🏦 Alias: pizza.express.mp · Titular: Juan Carlos Pérez
>
> 📦 **Menú (5 productos):**
> 🍕 *Pizzas:* Muzzarella $5500, Napolitana $6200
> 🥟 *Empanadas:* Carne x6 $4200
> 🥤 *Bebidas:* Coca-Cola 1.5L $2000
> 🍮 *Postres:* Flan con Dulce de Leche $3000
>
> ¿Está todo bien?
> Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.

---

**📱 Admin:**

> CONFIRMAR

**🤖 Bot:**

> 🎉 *¡Tu negocio está activo!*
>
> Pizza Express ya está listo para recibir pedidos.
>
> Podés modificar tu configuración en cualquier momento.
> Escribí *AYUDA* para ver los comandos disponibles.

---
---

## Path 2: Customer Messages — Business NOT Ready

A customer messages the number before the admin has finished onboarding (or before any admin has registered).

---

**📱 Customer:**

> Hola quiero pedir una pizza

**🤖 Bot:**

> El negocio se está configurando, volvé pronto.

---

**📱 Customer:**

> tienen delivery?

**🤖 Bot:**

> El negocio se está configurando, volvé pronto.

---

**📱 Customer:**

> 🍕🍕🍕

**🤖 Bot:**

> El negocio se está configurando, volvé pronto.

*Same response for any message. No variations, no extra info — simple and clear.*

---
---

## Path 3: Customer Messages — Business Active (Future)

After onboarding is complete. This is NOT built now — placeholder for future ordering chatbot.

---

**📱 Customer:**

> Hola quiero hacer un pedido

**🤖 Bot (future):**

> ¡Hola! 👋 Bienvenido a *Pizza Express*.
> [... ordering flow ...]

*Not implemented in MVP. For now, these messages also get handled — the bot could say:*

**🤖 Bot (MVP after activation):**

> ¡Hola! 👋 *Pizza Express* está en proceso de configurar su sistema de pedidos. Pronto vas a poder hacer pedidos por acá.

---
---

## Path 4: Invalid / Used Invite Code

---

### 4a: Code already used by another admin

**📱 Unknown number:**

> REST-A7X9

**🤖 Bot:**

> ❌ Este código ya fue utilizado. Si necesitás uno nuevo, contactá al administrador del sistema.

---

### 4b: Code format looks right but doesn't exist

**📱 Unknown number:**

> REST-ZZZZ

**🤖 Bot:**

> El negocio se está configurando, volvé pronto.

*Not found in the database — treated as a customer message. We don't reveal that the code format is valid to avoid probing.*

---

### 4c: Normal text that isn't a code

**📱 Unknown number:**

> Hola buenas tardes

**🤖 Bot:**

> El negocio se está configurando, volvé pronto.

---
---

## Path 5: AI Can't Parse Data (Retry Loop)

When AI extraction fails or data is incomplete.

---

### 5a: Business hours — unparseable

**📱 Admin (on step 2):**

> cuando queramos

**🤖 Bot:**

> 🤔 No pude interpretar el horario. Probá con un formato como:
> "Lunes a Viernes 11:00-23:00, Sábados 12:00-24:00"

---

### 5b: Bank data — missing fields

**📱 Admin (on step 6):**

> el alias es pizza.express.mp

**🤖 Bot:**

> ⚠️ Faltan datos obligatorios:
> • CBU/CVU
> • Titular de la cuenta
>
> Enviá todos los datos juntos:
> Alias, CBU/CVU y Titular.

---

### 5c: Products — no price detected

**📱 Admin (on step 7):**

> pizza grande y empanadas

**🤖 Bot:**

> ⚠️ No pude detectar el precio de estos productos:
> • Pizza grande — sin precio
> • Empanadas — sin precio
>
> Probá incluyendo el precio, ej: "Pizza grande $5500"

---

### 5d: Delivery zones — missing price

**📱 Admin (on step 5):**

> centro, almagro y caballito

**🤖 Bot:**

> ⚠️ Necesito el precio para cada zona. Probá así:
> "Centro $500, Almagro $600, Caballito $800"

---

### 5e: Payment methods — invalid option

**📱 Admin (on step 4):**

> tarjeta de crédito

**🤖 Bot:**

> ⚠️ Elegí una opción del 1 al 4:
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

---
---

## Path 6: Confirmation Corrections

When admin says "no" after an AI-parsed step.

---

### 6a: Correcting business hours

**🤖 Bot:**

> ✅ Horario guardado:
> *Lun-Vie 11:00-23:00, Sáb 12:00-00:00*
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí el horario de nuevo.

**📱 Admin:**

> no, los sabados cerramos a las 2 de la mañana

**🤖 Bot (AI re-parses):**

> ✅ Horario actualizado:
> *Lun-Vie 11:00-23:00, Sáb 12:00-02:00*
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí el horario de nuevo.

**📱 Admin:**

> si

**🤖 Bot:**

> **Paso 3 de 8** — ¿Cómo entregás los pedidos? ...

---

### 6b: Correcting delivery zones

**🤖 Bot:**

> ✅ Zonas de delivery guardadas:
> • Centro — $500
> • Almagro — $600
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí las zonas de nuevo.

**📱 Admin:**

> centro está bien pero almagro es 700 no 600

**🤖 Bot (AI re-parses):**

> ✅ Zonas actualizadas:
> • Centro — $500
> • Almagro — $700
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí las zonas de nuevo.

---

### 6c: Correcting bank data

**🤖 Bot:**

> ✅ Datos bancarios guardados:
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí los datos de nuevo.

**📱 Admin:**

> el titular es Juan Carlos López no Pérez

**🤖 Bot (AI re-parses):**

> ✅ Datos bancarios actualizados:
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos López
>
> ¿Está bien? Respondé *SÍ* para continuar o escribí los datos de nuevo.

---
---

## Path 7: Review Step — Admin Wants to Edit

At step 8 (review), admin can go back and change things.

---

**🤖 Bot (review summary shown):**

> ¿Está todo bien?
> Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.

**📱 Admin:**

> EDITAR

**🤖 Bot:**

> ¿Qué querés modificar?
>
> 1️⃣ Nombre
> 2️⃣ Horario
> 3️⃣ Entrega (delivery/retiro)
> 4️⃣ Métodos de pago
> 5️⃣ Zonas de delivery
> 6️⃣ Datos bancarios
> 7️⃣ Menú (productos)

---

**📱 Admin:**

> 7

**🤖 Bot:**

> 📦 Tu menú actual:
> 1. Pizza Muzzarella — $5500 (Pizzas) ✔️
> 2. Pizza Napolitana — $6200 (Pizzas) ✔️
> 3. Empanadas de Carne x6 — $4200 (Empanadas) ✔️
> 4. Coca-Cola 1.5L — $2000 (Bebidas) ✔️
> 5. Flan con Dulce de Leche — $3000 (Postres) ✔️
>
> ¿Qué querés hacer?
> • Escribí nuevos productos para agregar
> • Respondé *ELIMINAR 3* para borrar un producto (por número)
> • Respondé *LISTO* para volver al resumen

---

**📱 Admin:**

> ELIMINAR 4

**🤖 Bot:**

> ✅ *Coca-Cola 1.5L* eliminada del menú.
>
> 📦 Tu menú (4 productos):
> 1. Pizza Muzzarella — $5500 (Pizzas) ✔️
> 2. Pizza Napolitana — $6200 (Pizzas) ✔️
> 3. Empanadas de Carne x6 — $4200 (Empanadas) ✔️
> 4. Flan con Dulce de Leche — $3000 (Postres) ✔️
>
> Seguí editando o escribí *LISTO* para volver al resumen.

---

**📱 Admin:**

> sprite 1.5 litros $1800, categoría bebidas

**🤖 Bot:**

> ✅ Guardé 1 producto:
> • Sprite 1.5L — $1800 (Bebidas) ✔️
>
> Tu menú tiene 5 productos. Seguí editando o escribí *LISTO*.

---

**📱 Admin:**

> LISTO

**🤖 Bot:**

> 📋 **Resumen actualizado:**
>
> 🏪 *Pizza Express*
> ⏰ Lun-Vie 11:00-23:00, Sáb 12:00-00:00
> 📍 Av. Corrientes 1234, CABA
> 🚚 Delivery: Centro $500 · Almagro $600 · Caballito $800 · Flores $1000
> 💳 Pagos: Efectivo y Transferencia
> 🏦 Alias: pizza.express.mp · Titular: Juan Carlos Pérez
>
> 📦 **Menú (5 productos):**
> 🍕 *Pizzas:* Muzzarella $5500, Napolitana $6200
> 🥟 *Empanadas:* Carne x6 $4200
> 🥤 *Bebidas:* Sprite 1.5L $1800
> 🍮 *Postres:* Flan con Dulce de Leche $3000
>
> ¿Está todo bien?
> Respondé *CONFIRMAR* para activar o *EDITAR* para modificar algo.

---

### 7b: Editing payment methods from review

**📱 Admin:**

> EDITAR

**🤖 Bot:**

> ¿Qué querés modificar?
>
> 1️⃣ Nombre
> 2️⃣ Horario
> 3️⃣ Entrega (delivery/retiro)
> 4️⃣ Métodos de pago
> 5️⃣ Zonas de delivery
> 6️⃣ Datos bancarios
> 7️⃣ Menú (productos)

**📱 Admin:**

> 4

**🤖 Bot:**

> Tu configuración actual: *Efectivo y Transferencia*
>
> ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

**📱 Admin:**

> 4

**🤖 Bot:**

> ✅ Métodos de pago actualizados: *Efectivo y Transferencia (con opción de seña)*

---
---

## Path 8: Post-Onboarding Commands (After Activation)

Admin sends commands anytime after onboarding is complete.

---

### 8a: AYUDA

**📱 Admin:**

> AYUDA

**🤖 Bot:**

> 📖 *Comandos disponibles:*
>
> `EDITAR NOMBRE` — Cambiar nombre del negocio
> `EDITAR HORARIO` — Cambiar horario
> `EDITAR DIRECCIÓN` — Cambiar dirección
> `EDITAR ENTREGA` — Cambiar delivery/retiro
> `EDITAR PAGOS` — Cambiar métodos de pago
> `EDITAR ZONAS` — Cambiar zonas y precios
> `EDITAR BANCO` — Cambiar datos bancarios
> `AGREGAR PRODUCTO` — Agregar productos al menú
> `ELIMINAR PRODUCTO` — Eliminar un producto
> `PAUSAR PRODUCTO` — Pausar/activar un producto
> `VER MENÚ` — Ver tu menú actual
> `VER NEGOCIO` — Ver resumen del negocio

---

### 8b: EDITAR NOMBRE

**📱 Admin:**

> EDITAR NOMBRE

**🤖 Bot:**

> Tu nombre actual es: *Pizza Express*
>
> Escribí el nuevo nombre:

**📱 Admin:**

> Pizza Express Buenos Aires

**🤖 Bot:**

> ✅ Nombre actualizado: *Pizza Express Buenos Aires*

---

### 8c: EDITAR HORARIO

**📱 Admin:**

> EDITAR HORARIO

**🤖 Bot:**

> Tu horario actual: *Lun-Vie 11:00-23:00, Sáb 12:00-00:00*
>
> Escribí el nuevo horario:

**📱 Admin:**

> lunes a domingo de 11 a 23

**🤖 Bot (AI normalises):**

> ✅ Horario actualizado: *Lun-Dom 11:00-23:00*

---

### 8d: EDITAR ZONAS

**📱 Admin:**

> EDITAR ZONAS

**🤖 Bot:**

> Tus zonas actuales:
> • Centro — $500
> • Almagro — $600
> • Caballito — $800
> • Flores — $1000
>
> Escribí las zonas de nuevo (esto reemplaza todas las zonas anteriores):

**📱 Admin:**

> centro 600, almagro 700, caballito 900, flores 1200, villa crespo 700

**🤖 Bot (AI parses):**

> ✅ Zonas actualizadas:
> • Centro — $600
> • Almagro — $700
> • Caballito — $900
> • Flores — $1200
> • Villa Crespo — $700

---

### 8e: EDITAR BANCO

**📱 Admin:**

> EDITAR BANCO

**🤖 Bot:**

> Tus datos bancarios actuales:
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> Enviá los nuevos datos (alias, CBU/CVU y titular):

**📱 Admin:**

> alias pizzaexpress2024 cbu 1234567890123456789012 titular María García

**🤖 Bot (AI extracts):**

> ✅ Datos bancarios actualizados:
> • Alias: pizzaexpress2024
> • CBU: 1234567890123456789012
> • Titular: María García

---

### 8f: EDITAR PAGOS

**📱 Admin:**

> EDITAR PAGOS

**🤖 Bot:**

> Tu configuración actual: *Efectivo y Transferencia*
>
> ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

**📱 Admin:**

> 1

**🤖 Bot:**

> ✅ Métodos de pago actualizados: *Solo efectivo*

---

### 8g: EDITAR PAGOS — option 4 (with deposit)

**📱 Admin:**

> EDITAR PAGOS

**🤖 Bot:**

> Tu configuración actual: *Solo efectivo*
>
> ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

**📱 Admin:**

> 4

**🤖 Bot:**

> ✅ Métodos de pago actualizados: *Efectivo y Transferencia (con opción de seña)*

---

### 8h: AGREGAR PRODUCTO

**📱 Admin:**

> AGREGAR PRODUCTO

**🤖 Bot:**

> Describí los productos que querés agregar.
> Ej: "Milanesa napolitana $7500, categoría Platos principales"
>
> Cuando termines, escribí *LISTO*.

**📱 Admin:**

> pizza con roquefort $7000 en pizzas. Cerveza artesanal pinta $3500 en bebidas

**🤖 Bot (AI extracts):**

> ✅ Guardé 2 productos:
> • Pizza con Roquefort — $7000 (Pizzas) ✔️
> • Cerveza Artesanal Pinta — $3500 (Bebidas) ✔️
>
> Seguí agregando o escribí *LISTO*.

**📱 Admin:**

> LISTO

**🤖 Bot:**

> ✅ Menú actualizado. Tu menú tiene 7 productos.

---

### 8i: ELIMINAR PRODUCTO

**📱 Admin:**

> ELIMINAR PRODUCTO

**🤖 Bot:**

> 📦 Tu menú:
> 1. Pizza Muzzarella — $5500 (Pizzas) ✔️
> 2. Pizza Napolitana — $6200 (Pizzas) ✔️
> 3. Empanadas de Carne x6 — $4200 (Empanadas) ✔️
> 4. Sprite 1.5L — $1800 (Bebidas) ✔️
> 5. Flan con Dulce de Leche — $3000 (Postres) ✔️
> 6. Pizza con Roquefort — $7000 (Pizzas) ✔️
> 7. Cerveza Artesanal Pinta — $3500 (Bebidas) ✔️
>
> Respondé con el número del producto a eliminar (ej: *3*):

**📱 Admin:**

> 7

**🤖 Bot:**

> ✅ *Cerveza Artesanal Pinta* eliminada del menú.

---

### 8j: PAUSAR PRODUCTO

**📱 Admin:**

> PAUSAR PRODUCTO

**🤖 Bot:**

> 📦 Tu menú:
> 1. Pizza Muzzarella — $5500 (Pizzas) ✔️
> 2. Pizza Napolitana — $6200 (Pizzas) ✔️
> 3. Empanadas de Carne x6 — $4200 (Empanadas) ✔️
> 4. Sprite 1.5L — $1800 (Bebidas) ✔️
> 5. Flan con Dulce de Leche — $3000 (Postres) ✔️
> 6. Pizza con Roquefort — $7000 (Pizzas) ✔️
>
> Respondé con el número del producto a pausar/activar:

**📱 Admin:**

> 3

**🤖 Bot:**

> ⏸️ *Empanadas de Carne x6* pausado. No aparecerá en el menú para los clientes.
>
> Para reactivarlo, usá *PAUSAR PRODUCTO* y seleccionalo de nuevo.

---

### 8k: VER MENÚ

**📱 Admin:**

> VER MENÚ

**🤖 Bot:**

> 📦 **Menú de Pizza Express Buenos Aires** (5 activos, 1 pausado):
>
> 🍕 *Pizzas:*
> • Pizza Muzzarella — $5500 ✔️
> • Pizza Napolitana — $6200 ✔️
> • Pizza con Roquefort — $7000 ✔️
>
> 🥟 *Empanadas:*
> • ~~Empanadas de Carne x6 — $4200~~ ⏸️
>
> 🥤 *Bebidas:*
> • Sprite 1.5L — $1800 ✔️
>
> 🍮 *Postres:*
> • Flan con Dulce de Leche — $3000 ✔️

---

### 8l: VER NEGOCIO

**📱 Admin:**

> VER NEGOCIO

**🤖 Bot:**

> 📋 **Resumen de Pizza Express Buenos Aires:**
>
> 🏪 *Pizza Express Buenos Aires*
> ⏰ Lun-Dom 11:00-23:00
> 📍 Av. Corrientes 1234, CABA
> 🚚 Delivery: Centro $600 · Almagro $700 · Caballito $900 · Flores $1200 · Villa Crespo $700
> 💳 Pagos: Efectivo y Transferencia (con opción de seña)
> 🏦 Alias: pizzaexpress2024 · Titular: María García
> 📦 Menú: 5 activos, 1 pausado
> ✅ Estado: Activo

---

### 8m: EDITAR ENTREGA (changing from "both" to "delivery only")

**📱 Admin:**

> EDITAR ENTREGA

**🤖 Bot:**

> Tu configuración actual:
> • 🚚 Delivery: Sí
> • 🏪 Retiro en local: Sí
> • 📍 Dirección: Av. Corrientes 1234, CABA
>
> ¿Cómo entregás los pedidos?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local
> 3️⃣ Ambos

**📱 Admin:**

> 1

**🤖 Bot:**

> ✅ Actualizado: solo delivery (sin retiro en local).

---

### 8n: Admin sends unrecognised command

**📱 Admin (onboarding complete):**

> hola como va

**🤖 Bot:**

> 👋 ¡Hola! Escribí *AYUDA* para ver los comandos disponibles.

---

### 8o: Admin sends unrecognised command while editing

**📱 Admin (mid-edit, was asked for new business name):**

> AYUDA

**🤖 Bot:**

> ⚠️ Estás editando el nombre de tu negocio.
> Escribí el nuevo nombre o respondé *CANCELAR* para salir sin cambios.

---
---

## Path 9: Delivery-Only Business (No Pickup)

Admin chooses delivery only — no address is asked.

---

**🤖 Bot:**

> **Paso 3 de 8** — ¿Cómo entregás los pedidos?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local
> 3️⃣ Ambos

**📱 Admin:**

> 1

**🤖 Bot:**

> ✅ Configuración guardada: solo delivery.
>
> **Paso 4 de 8** — ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

*Skips address question, goes straight to payment methods.*

---
---

## Path 10: Pickup-Only Business (No Delivery)

Admin chooses pickup only — no zones are asked.

---

**🤖 Bot:**

> **Paso 3 de 8** — ¿Cómo entregás los pedidos?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local
> 3️⃣ Ambos

**📱 Admin:**

> 2

**🤖 Bot:**

> ¿Cuál es la dirección de tu local?

**📱 Admin:**

> Av. Santa Fe 2100, Recoleta

**🤖 Bot:**

> ✅ Configuración guardada:
> • 🏪 Retiro en local: Sí
> • 📍 Dirección: Av. Santa Fe 2100, Recoleta
>
> **Paso 4 de 8** — ¿Qué métodos de pago aceptás?
>
> 1️⃣ Solo efectivo
> 2️⃣ Solo transferencia bancaria
> 3️⃣ Ambos (efectivo y transferencia)
> 4️⃣ Ambos + seña (depósito parcial por transferencia)

*After payment methods, skips zones entirely, goes straight to bank data.*

---
---

## Path 11: Payment Methods — All 4 Options (Confirmation Messages)

Shows what the bot confirms for each payment option.

---

### 11a: Option 1 — Cash only

**📱 Admin:**

> 1

**🤖 Bot:**

> ✅ Métodos de pago guardados: *Solo efectivo*

---

### 11b: Option 2 — Transfer only

**📱 Admin:**

> 2

**🤖 Bot:**

> ✅ Métodos de pago guardados: *Solo transferencia bancaria*

---

### 11c: Option 3 — Both

**📱 Admin:**

> 3

**🤖 Bot:**

> ✅ Métodos de pago guardados: *Efectivo y Transferencia*

---

### 11d: Option 4 — Both + deposit

**📱 Admin:**

> 4

**🤖 Bot:**

> ✅ Métodos de pago: *Efectivo y Transferencia (con opción de seña)*
>
> ¿Qué porcentaje de seña pedís? (ej: 30, 50)
> Esto es lo que el cliente paga por adelantado via transferencia.

**📱 Admin:**

> 30

**🤖 Bot:**

> ✅ Métodos de pago guardados: *Efectivo y Transferencia (con seña del 30%)*

---
---

# CUSTOMER ORDERING FLOW

---

## Path 12: Customer Orders — Full Happy Path (Delivery + Transfer)

Customer places a delivery order paying by bank transfer.

---

**📱 Customer (first message):**

> Hola

**🤖 Bot:**

> 👋 ¡Hola! Bienvenido a *Pizza Express*
> ⏰ Horario: Lun-Vie 11:00-23:00, Sáb 12:00-00:00
>
> Escribí *MENÚ* para ver nuestros productos o decinos directamente qué querés pedir.

---

**📱 Customer:**

> MENÚ

**🤖 Bot:**

> 📦 *Menú de Pizza Express:*
>
> *Pizzas:*
> • Pizza Muzzarella — $5500
> • Pizza Napolitana — $6200
>
> *Empanadas:*
> • Empanadas de Carne x6 — $4200
>
> *Bebidas:*
> • Coca-Cola 1.5L — $2000
>
> Escribí lo que querés pedir (ej: "2 muzzarella y 1 coca")

---

**📱 Customer:**

> quiero 2 pizzas muzzarella y unas empanadas

**🤖 Bot (AI parses):**

> 🛒 *Tu pedido:*
> 1. 2x Pizza Muzzarella — $11.000
> 2. 1x Empanadas de Carne x6 — $4.200
>
> 📋 Subtotal: *$15.200*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> SEGUIR

**🤖 Bot:**

> 🚚 ¿Cómo querés recibir tu pedido?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local (📍 Av. Corrientes 1234, CABA)

---

**📱 Customer:**

> 1

**🤖 Bot:**

> 🚚 *Zonas de delivery:*
> 1️⃣ Centro — $500
> 2️⃣ Almagro — $600
> 3️⃣ Caballito — $800
> 4️⃣ Flores — $1000
>
> ¿En qué zona estás? Respondé con el número.

---

**📱 Customer:**

> 1

**🤖 Bot:**

> ¿Cuál es tu dirección de entrega?

---

**📱 Customer:**

> Av. Rivadavia 3456

**🤖 Bot:**

> 📋 *Resumen de tu pedido:*
>
> 🛒 2x Pizza Muzzarella — $11.000
> 🛒 1x Empanadas de Carne x6 — $4.200
> 📋 Subtotal: $15.200
> 🚚 Delivery (Centro): $500
> 💰 *Total: $15.700*
>
> 💳 ¿Cómo querés pagar?
>
> 1️⃣ Efectivo (pagás al recibir)
> 2️⃣ Transferencia bancaria (total: $15.700)

---

**📱 Customer:**

> 2

**🤖 Bot:**

> 🏦 *Datos para transferir:*
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> 💰 Monto a transferir: *$15.700*
>
> Cuando hayas transferido, respondé *LISTO*.

---

**📱 Customer:**

> LISTO

**🤖 Bot:**

> ✅ ¡Pedido confirmado! 🎉
>
> 📦 Pedido #1
> 💰 Total: $15.700
> 💳 Pago: Transferencia bancaria
> 🚚 Delivery a: Av. Rivadavia 3456, Centro
>
> Te avisamos cuando tu pedido esté en preparación.
> Podés consultar el estado escribiendo *ESTADO #1*.
> Para cancelar, escribí *CANCELAR #1* (antes de que el local confirme).

---

*Meanwhile, the admin receives:*

**🤖 Bot → Admin:**

> 🔔 *Nuevo pedido #1*
>
> 📱 Cliente: +5491112345678
> 🛒 2x Pizza Muzzarella — $11.000
> 🛒 1x Empanadas de Carne x6 — $4.200
> 🚚 Delivery (Centro): $500
> 💰 Total: $15.700
> 💳 Pago: Transferencia bancaria (pendiente de confirmación)
>
> Respondé *CONFIRMAR PAGO #1* cuando recibas la transferencia.
> Respondé *RECHAZAR PEDIDO #1* para cancelar.

---
---

## Path 13: Customer Orders — Pickup + Cash

Customer orders for pickup, pays in cash.

---

**📱 Customer:**

> hola quiero una napolitana y una coca

**🤖 Bot (AI parses):**

> 🛒 *Tu pedido:*
> 1. 1x Pizza Napolitana — $6.200
> 2. 1x Coca-Cola 1.5L — $2.000
>
> 📋 Subtotal: *$8.200*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> SEGUIR

**🤖 Bot:**

> 🚚 ¿Cómo querés recibir tu pedido?
>
> 1️⃣ Delivery
> 2️⃣ Retiro en local (📍 Av. Corrientes 1234, CABA)

---

**📱 Customer:**

> 2

**🤖 Bot:**

> 📋 *Resumen de tu pedido:*
>
> 🛒 1x Pizza Napolitana — $6.200
> 🛒 1x Coca-Cola 1.5L — $2.000
> 📋 Subtotal: $8.200
> 🏪 Retiro en: Av. Corrientes 1234, CABA
> 💰 *Total: $8.200*
>
> 💳 ¿Cómo querés pagar?
>
> 1️⃣ Efectivo (pagás al retirar)
> 2️⃣ Transferencia bancaria (total: $8.200)

---

**📱 Customer:**

> 1

**🤖 Bot:**

> ✅ ¡Pedido confirmado! 🎉
>
> 📦 Pedido #2
> 💰 Total: $8.200
> 💳 Pago: Efectivo
> 🏪 Retiro en: Av. Corrientes 1234, CABA
>
> Te avisamos cuando esté listo para retirar.
> Podés consultar el estado escribiendo *ESTADO #2*.

---
---

## Path 14: Customer Orders — Delivery + Deposit (Seña)

Customer pays a 30% deposit upfront.

---

**📱 Customer:**

> quiero 3 pizzas muzzarella

**🤖 Bot:**

> 🛒 *Tu pedido:*
> 1. 3x Pizza Muzzarella — $16.500
>
> 📋 Subtotal: *$16.500*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> SEGUIR

*(Selects delivery, zone Centro $500, gives address)*

**🤖 Bot:**

> 📋 *Resumen de tu pedido:*
>
> 🛒 3x Pizza Muzzarella — $16.500
> 🚚 Delivery (Centro): $500
> 💰 *Total: $17.000*
>
> 💳 ¿Cómo querés pagar?
>
> 1️⃣ Efectivo (pagás al recibir)
> 2️⃣ Transferencia bancaria (total: $17.000)
> 3️⃣ Seña por transferencia (30%: $5.100)

---

**📱 Customer:**

> 3

**🤖 Bot:**

> 🏦 *Datos para transferir:*
> • Alias: pizza.express.mp
> • CBU: 0000003100092810733816
> • Titular: Juan Carlos Pérez
>
> 💰 Monto de la seña: *$5.100* (30% de $17.000)
> 💰 Restante a pagar al recibir: *$11.900*
>
> Cuando hayas transferido, respondé *LISTO*.

---

**📱 Customer:**

> LISTO

**🤖 Bot:**

> ✅ ¡Pedido confirmado! 🎉
>
> 📦 Pedido #3
> 💰 Total: $17.000
> 💳 Pago: Seña $5.100 (transferencia) + $11.900 (efectivo al recibir)
> 🚚 Delivery a: Av. Santa Fe 999, Centro
>
> Te avisamos cuando tu pedido esté en preparación.

---
---

## Path 15: Customer Orders — Outside Business Hours

---

**📱 Customer:**

> Hola quiero pedir

**🤖 Bot:**

> 🕐 *Pizza Express* está cerrado en este momento.
> ⏰ Nuestro horario: Lun-Vie 11:00-23:00, Sáb 12:00-00:00
>
> ¡Volvé cuando estemos abiertos!

---
---

## Path 16: Customer Cart Editing

Customer adds items, removes one, then continues.

---

**📱 Customer:**

> quiero 2 muzzarella, 1 napolitana y empanadas

**🤖 Bot:**

> 🛒 *Tu pedido:*
> 1. 2x Pizza Muzzarella — $11.000
> 2. 1x Pizza Napolitana — $6.200
> 3. 1x Empanadas de Carne x6 — $4.200
>
> 📋 Subtotal: *$21.400*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> QUITAR 2

**🤖 Bot:**

> ✅ *Pizza Napolitana* eliminada del pedido.
>
> 🛒 *Tu pedido:*
> 1. 2x Pizza Muzzarella — $11.000
> 2. 1x Empanadas de Carne x6 — $4.200
>
> 📋 Subtotal: *$15.200*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> sí, agregá una coca

**🤖 Bot:**

> 🛒 *Tu pedido:*
> 1. 2x Pizza Muzzarella — $11.000
> 2. 1x Empanadas de Carne x6 — $4.200
> 3. 1x Coca-Cola 1.5L — $2.000
>
> 📋 Subtotal: *$17.200*
>
> ¿Querés agregar algo más?
> Respondé *SÍ* para seguir, *QUITAR 1* para eliminar un item, o *SEGUIR* para continuar.

---

**📱 Customer:**

> SEGUIR

*(Continues to delivery/payment steps...)*

---
---

## Path 17: Customer Status Check & Cancellation

---

### 17a: Status check

**📱 Customer:**

> ESTADO #1

**🤖 Bot:**

> 📦 Pedido #1 — Estado: *Preparando* 🍳
>
> Te avisamos cuando esté en camino.

---

### 17b: Customer cancellation (allowed — order still "nuevo")

**📱 Customer:**

> CANCELAR #2

**🤖 Bot:**

> ❌ Pedido #2 cancelado.

---

### 17c: Customer cancellation (denied — order already being prepared)

**📱 Customer:**

> CANCELAR #1

**🤖 Bot:**

> ⚠️ El pedido #1 ya está en preparación y no se puede cancelar.
> Si necesitás ayuda, contactá al local.

---
---

## Path 18: Admin Order Management Commands

---

### 18a: VER PEDIDOS

**📱 Admin:**

> VER PEDIDOS

**🤖 Bot:**

> 📋 *Pedidos pendientes:*
>
> #1 — 2x Pizza Muzzarella, 1x Empanadas — $15.700 — Transferencia (⏳ pendiente) — 🚚 Centro
> #3 — 3x Pizza Muzzarella — $17.000 — Seña $5.100 (⏳ pendiente) — 🚚 Centro
>
> Para ver detalles: *VER PEDIDO #1*
> Para confirmar pago: *CONFIRMAR PAGO #1*

---

### 18b: VER PEDIDO #1

**📱 Admin:**

> VER PEDIDO #1

**🤖 Bot:**

> 📦 *Pedido #1*
>
> 📱 Cliente: +5491112345678
> 🛒 2x Pizza Muzzarella — $11.000
> 🛒 1x Empanadas de Carne x6 — $4.200
> 📋 Subtotal: $15.200
> 🚚 Delivery (Centro): $500
> 📍 Av. Rivadavia 3456
> 💰 Total: $15.700
> 💳 Pago: Transferencia bancaria
> 💰 Estado pago: Pendiente
> 📦 Estado: Nuevo

---

### 18c: CONFIRMAR PAGO #1

**📱 Admin:**

> CONFIRMAR PAGO #1

**🤖 Bot:**

> ✅ Pago del pedido #1 confirmado.

*Customer receives:*

**🤖 Bot → Customer:**

> ✅ ¡Tu pago del pedido #1 fue confirmado! Tu pedido está siendo preparado 🍳

---

### 18d: ESTADO PEDIDO #1 en_camino

**📱 Admin:**

> ESTADO PEDIDO #1 en_camino

**🤖 Bot:**

> ✅ Pedido #1 actualizado: *En camino* 🛵

*Customer receives:*

**🤖 Bot → Customer:**

> 🛵 ¡Tu pedido #1 está en camino!

---

### 18e: ESTADO PEDIDO #1 entregado

**📱 Admin:**

> ESTADO PEDIDO #1 entregado

**🤖 Bot:**

> ✅ Pedido #1 actualizado: *Entregado* ✅

*Customer receives:*

**🤖 Bot → Customer:**

> ✅ ¡Tu pedido #1 fue entregado! ¡Gracias por tu compra! 🎉

---

### 18f: RECHAZAR PEDIDO #3

**📱 Admin:**

> RECHAZAR PEDIDO #3

**🤖 Bot:**

> ❌ Pedido #3 rechazado.

*Customer receives:*

**🤖 Bot → Customer:**

> ❌ Lo sentimos, tu pedido #3 fue cancelado por el local.
> Si tenés preguntas, contactá directamente al negocio.

---

### 18g: VENTAS HOY

**📱 Admin:**

> VENTAS HOY

**🤖 Bot:**

> 📊 *Ventas de hoy:*
>
> 📦 Pedidos: 5
> ✅ Entregados: 3
> ❌ Cancelados: 1
> ⏳ En proceso: 1
> 💰 Total facturado: $67.500
> 💳 Cobrado por transferencia: $42.300
> 💵 Cobrado en efectivo: $25.200

---
---

## Path 19: Customer Orders — Menu then Direct Order

Customer views menu first, then orders specific items.

---

**📱 Customer:**

> hola

**🤖 Bot:**

> 👋 ¡Hola! Bienvenido a *Pizza Express*
> ⏰ Horario: Lun-Vie 11:00-23:00, Sáb 12:00-00:00
>
> Escribí *MENÚ* para ver nuestros productos o decinos directamente qué querés pedir.

---

**📱 Customer:**

> menú

*(Bot shows full menu)*

**📱 Customer:**

> una napolitana y un flan con dulce de leche

**🤖 Bot (AI parses, matches against actual menu):**

> 🛒 *Tu pedido:*
> 1. 1x Pizza Napolitana — $6.200
> 2. 1x Flan con Dulce de Leche — $3.000
>
> 📋 Subtotal: *$9.200*
>
> ¿Querés agregar algo más?

---
---

## Path 20: Customer Orders — Product Not Found

---

**📱 Customer:**

> quiero una hamburguesa

**🤖 Bot:**

> ⚠️ No encontré "hamburguesa" en nuestro menú.
>
> Escribí *MENÚ* para ver los productos disponibles.

---
---

## Summary: All Bot States

| Sender | Bot State | Behavior |
|---|---|---|
| Unknown number + valid unused code | No state | Register admin → Start onboarding |
| Unknown number + used code | No state | "Este código ya fue utilizado" |
| Unknown number + any text | Business NOT active | "El negocio se está configurando, volvé pronto." |
| Unknown number + any text | Business IS active, inside hours | Customer greeting → ordering flow |
| Unknown number + any text | Business IS active, outside hours | "Está cerrado" + horario |
| Customer (mid-order) | Has customer_state | Continue current order step |
| Customer | Order completed | Status check (ESTADO #N), Cancel (CANCELAR #N), or new order |
| Known admin | Mid-onboarding | Continue current step |
| Known admin | In confirmation (SÍ/NO) | Accept or re-do current step |
| Known admin | Completed | Parse commands (EDITAR, VER, PEDIDOS, VENTAS, etc.) |
| Known admin | Mid-edit | Handle edit flow, CANCELAR to exit |
| Known admin + unrecognised text | Completed | "Escribí AYUDA para ver los comandos" |
