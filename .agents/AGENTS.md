# Reglas del proyecto ERP-POS

## Git: siempre hacer commit y push

Después de **cualquier cambio en archivos del proyecto**, siempre ejecutar:

```
git add <archivos modificados>
git commit -m "<mensaje descriptivo>"
git push
```

No esperar a que el usuario lo pida. Hacerlo automáticamente al terminar cada tarea.

### Nunca con `git add .`

Añadir **siempre los archivos por nombre**. `git add .` / `git add -A` arrastran
secretos sin querer: ya ha pasado con `scratch/revolut_certs/private_key.pem` y
con los scripts de `scratch/` que llevan el `client_id` y el `refresh_token` de
Revolut en claro.

`scratch/` está en `.gitignore` entero, junto con `*.pem`, `*.cer`, `*.key` y
`.env*`. Antes de commitear algo nuevo, comprobar que no contiene credenciales.

## Credenciales

- Las claves de bancos y APIs viven **solo en Supabase Secrets**, nunca en el
  repo ni en `index.html`.
- El remote de git no debe llevar el token dentro de la URL: se guarda en el
  Credential Manager de Windows (`git config --global credential.helper manager`).
