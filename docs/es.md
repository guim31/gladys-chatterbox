# Chatterbox TTS

Da a Gladys una voz expresiva con **Chatterbox**, el modelo de síntesis de voz
libre (licencia MIT) de [Resemble AI](https://www.resemble.ai), servido por
[Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) en un
equipo de su red: los textos se quedan en casa. Los anuncios de sus escenas se
dicen con él en sus altavoces.

Desarrollada sin tarjeta gráfica: sus comentarios son bienvenidos.

## Lo que obtiene

- Una **voz para Gladys** (Gladys 5.3.0 o posterior): una vez elegida, la
  acción de escena **Hablar en un altavoz** habla con Chatterbox en sus
  altavoces (Sonos, Google Cast, AirPlay…).
- **Francés, inglés, alemán y español** con el modelo multilingüe: cada
  usuario oye su idioma, o un idioma fijo que usted elija.
- **Una voz por idioma**: una de las 28 voces listas del servidor (Emily,
  Gabriel, Olivia…), o una voz **clonada** a partir de una grabación de 10 a
  20 segundos puesta en el servidor.
- Ajustes de **expresividad** (de monótona a dramática) y de **velocidad**.
- Los botones **Probar la voz** (con el tiempo empleado) y **Mostrar las
  voces** en la configuración.
- Dos disparadores de escena: **Servidor Chatterbox no disponible** y
  **Servidor Chatterbox de vuelta**.

## Antes de empezar

- Instale Chatterbox-TTS-Server (Docker o Python, vea su README), puerto 8004
  por defecto.
- **En la práctica se necesita una tarjeta gráfica.** Gladys espera el clip
  30 segundos. Medido en un mini PC de 4 núcleos sin tarjeta gráfica, con el
  modelo multilingüe: de uno a dos minutos para un simple «Sí.» o una frase
  corta, demasiado para un anuncio. Con una tarjeta gráfica NVIDIA o AMD, una frase
  tarda de uno a pocos segundos.
- Para el francés, el alemán o el español, configure en su `config.yaml`:
  `model: repo_id: chatterbox-multilingual` (unos 3 GB descargados en el
  primer arranque). El modelo por defecto, `chatterbox-turbo`, solo habla
  inglés.
- Solo con procesador, la versión actual de Chatterbox-TTS-Server no carga el
  modelo multilingüe (error `Attempting to deserialize object on a CUDA
device`): un defecto del servidor, corregido en el Chatterbox oficial de
  Resemble AI.
- Voces clonadas: ponga un WAV o MP3 limpio (una sola persona, sin música) en
  la carpeta `reference_audio` del servidor. Clone solo voces que tenga
  derecho a usar.
- Cada clip lleva una marca de agua de audio inaudible (Perth) de Resemble AI,
  que señala un sonido generado por IA.
- Sin relación con Resemble AI ni con el autor de Chatterbox-TTS-Server.

## Configuración

1. Instale la integración y abra su pestaña **Configuración**.
2. **Dirección del servidor**: por ejemplo `http://<host>:8004`. Un simple
   `host:puerto` recibe `http://`.
3. **Idioma**: Automático (el idioma del usuario de Gladys, el francés si se
   desconoce) o un idioma fijo.
4. **Voz para el francés / el inglés / el alemán / el español**: el nombre de
   una voz lista (`Emily`, `Gabriel`…) o de una grabación de `reference_audio`
   (`Mi_voz`), con o sin `.wav`. Vacío: Emily.
5. **Expresividad** y **Velocidad**: «Ajuste del servidor» conserva el de su
   `config.yaml`. 0,5 da una voz neutra; por encima, la voz es más emotiva y
   más rápida. El modelo Turbo ignora la expresividad.
6. Guarde, pulse **Mostrar las voces** y luego **Probar la voz** para
   comprobar que vuelve un clip (segundos de sonido y tiempo empleado; el
   botón no lo reproduce).
7. Abra **Integraciones → Inteligencia artificial** y elija Chatterbox TTS en
   la tarjeta **Voz**.

## Uso en las escenas

Añada una acción **Hablar en un altavoz** a una escena, elija un altavoz y
escriba el texto. Gladys pide el clip a esta integración y luego lo sirve al
altavoz en su red local.

Los disparadores **Servidor Chatterbox no disponible** y **Servidor
Chatterbox de vuelta** inician una escena, por ejemplo para enviarle un
mensaje. El servidor se comprueba cada 5 minutos.

El asistente de voz de Gladys sigue en texto con una integración de voz: su
página se sirve en HTTPS y el clip en HTTP en la red local, lo que el
navegador bloquea. Es un límite de Gladys, el mismo para todas las
integraciones de voz.

## Límites

- **Gladys espera 30 segundos** el clip (la integración abandona a los 25 s):
  sin tarjeta gráfica, los anuncios fallan. Un texto que supera el plazo falla
  sin marcar el servidor como no disponible.
- Un modelo solo en inglés (`chatterbox-turbo`, `chatterbox`) rechaza el
  francés, el alemán y el español en lugar de leerlos con sonidos ingleses; la
  Supervisión lo indica.
- Los clips son WAV (24 kHz). Gladys rechaza los clips de más de 5 MB (unos
  100 segundos): un clip más largo se remuestrea más bajo.
- Un clip ya hecho (mismo texto y mismos ajustes) se guarda en memoria (los
  16 últimos), y un anuncio en varios altavoces solo solicita el servidor una
  vez.
- Sin contraseña: Chatterbox-TTS-Server no la pide. No lo exponga fuera de su
  red.

## Solución de problemas

- La **Supervisión** indica si el servidor responde, con su modelo, o si
  todavía carga su modelo.
- Un anuncio fallido se escribe en los **registros** de la integración, con la
  razón dada por el servidor (voz no encontrada, sin respuesta a tiempo…). El
  texto dicho nunca se escribe.
- «No tiene ninguna voz con este nombre»: pulse **Mostrar las voces** y copie
  un nombre de la lista.
- «No se puede acceder»: compruebe la dirección, el puerto (8004 por defecto)
  y que el servidor escuche en `0.0.0.0`.
- Más detalles en debug: ponga el nivel de registro de la integración en
  debug.
