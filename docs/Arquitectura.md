# Arquitectura del Sistema

La aplicación está contenida principalmente en un único archivo gigante `index.html` (más de 9,700 líneas), donde convive el HTML, CSS y la lógica JavaScript.

## Bases de Datos
1. **Supabase (La Nube):**
   - Utilizamos Supabase para sincronizar en tiempo real el registro de transacciones de las cajas.
   - La tabla principal en la nube se llama `mov_cajas`.
   - La API pública está expuesta vía variables `SUPA_URL` y `SUPA_KEY`.
2. **Local Storage (Navegador):**
   - Todo lo demás (Préstamos, Inventario, Deudas, Categorías) se guarda en la memoria local del navegador (`localStorage`).
   - Las deudas, por ejemplo, se guardan en un arreglo JSON llamado `erp_prestamos`.

## Reglas Contables de las Deudas
- Las deudas no pueden pagarse por más del monto adeudado (no se permiten sobrepagos en el sistema de préstamos).
- Si la deuda requiere cambio de moneda (por ejemplo, EUR a USD), el sistema calculará un factor automático de conversión para registrar en caja un monto equivalente en la moneda original de la deuda.
- Al liquidar o borrar una deuda, el sistema cuenta con políticas de reversión para que la caja principal nunca se descuadre.
