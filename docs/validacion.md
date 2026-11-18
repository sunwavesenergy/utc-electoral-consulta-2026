# Validación de los padrones fuente

Revisión realizada el 18 de noviembre de 2026. No se incluyen nombres ni cédulas en este reporte.

## Las 49 filas que parecían tener cédulas faltantes

No son votantes. Son encabezados repetidos que el primer importador contó por error:

- Fila 9 en las 47 hojas restantes del padrón electoral.
- Fila 13 en `Padron 6- Docentes EX - LA MANÁ`.
- Fila 97, encabezado repetido, en `Padron-37`.

El importador ya ignora estos encabezados. La validación corregida registra 9.264 votantes con cédulas únicas, cero duplicados y cero cédulas incompletas.

## Cruce con los dos archivos fuente

- **Estudiantes:** 8.948 filas de origen, 8.946 cédulas únicas válidas. Dos filas repiten cédula y nombre. Las 8.946 cédulas únicas aparecen en el padrón electoral.
- **Docentes:** 326 cédulas válidas en la hoja de profesores; 318 aparecen en el padrón electoral y 8 no. La hoja separada de técnicos docentes contiene 53 cédulas válidas; ninguna aparece en el padrón electoral. La UTC debe confirmar si esas 8 personas y el grupo de técnicos debían ser elegibles antes de añadirlos.
- Los 9.264 números de cédula del padrón electoral encuentran correspondencia en al menos uno de los dos archivos fuente. No se detectaron cédulas electorales sin correspondencia.

## Otros datos

- El padrón electoral tiene 48 hojas y cubre juntas numeradas del 1 al 48; el libro de juntas coincide (incluye 37A y 37B).
- Las direcciones exactas de los recintos no están confirmadas en los archivos; el enlace a Maps permanece desactivado.
- El libro de juntas contiene datos personales de personas designadas. El buscador no expone designaciones, correos ni cédulas de esas personas.

El SQL real se genera y permanece en `.private/`; no está incluido en el repositorio ni en el ZIP público.
