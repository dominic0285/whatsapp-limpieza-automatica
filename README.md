# 🧹 WhatsApp Limpieza Automática

Script de Node.js que revisa tus chats de WhatsApp y **borra automáticamente los mensajes que contienen información sensible específica**: contraseñas, datos bancarios, números de tarjeta, correos, teléfonos o cualquier palabra clave que tú definas. Útil para limpiar datos privados que quedaron en conversaciones antiguas.

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![whatsapp-web.js](https://img.shields.io/badge/whatsapp--web.js-25D366?logo=whatsapp&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-IA-8E75B2?logo=googlegemini&logoColor=white)

---

## ✨ Cómo funciona

1. Te conectas escaneando un **código QR** (como WhatsApp Web).
2. Eliges el chat y cuántos mensajes hacia atrás revisar.
3. Cada mensaje pasa por un **filtro en dos etapas**:
   - **Detección local**: palabras clave configurables + expresiones regulares (tarjetas, correos, teléfonos).
   - **Confirmación con IA (opcional)**: Google Gemini decide si realmente es información sensible, para evitar falsos positivos.
4. **Modo simulación**: muestra qué borraría sin tocar nada.
5. Guarda un reporte local (`reporte_borrados.txt`) con fecha, chat y motivo — sin copiar el contenido borrado.

## ⚙️ Configuración

> 💡 **En Windows no hagas doble clic en `buscar_y_borrar.js`**: Windows lo abre con *Windows Script Host* (un intérprete antiguo) y muestra "Error de sintaxis". Usa **`INICIAR.bat`** (doble clic) o ejecútalo con Node.js desde la terminal.

```bash
npm install
cp .env.example .env        # opcional: pon tu GEMINI_API_KEY
npm start
```

Personaliza qué se considera sensible editando `PALABRAS_CLAVE` y `PATRONES` al inicio de `buscar_y_borrar.js`.

> ⚠️ Los mensajes borrados no se pueden recuperar. Prueba primero con el modo simulación.
> WhatsApp solo permite "borrar para todos" tus propios mensajes recientes; el resto se borran solo para ti.

## 📦 Crear un ejecutable (.exe) opcional

Para usarlo sin instalar Node.js puedes empaquetarlo con [`pkg`](https://github.com/vercel/pkg) o con `nexe`:

```bash
npx pkg buscar_y_borrar.js --targets node18-win-x64 --output limpieza-whatsapp.exe
```

> `whatsapp-web.js` descarga Chromium (Puppeteer) la primera vez; el `.exe` necesita conexión a internet en ese primer arranque.

## 👤 Autor

**Dominic De Freitas** — [GitHub](https://github.com/dominic0285) · [LinkedIn](https://www.linkedin.com/in/dominic-de-freitas-07102828a/)
