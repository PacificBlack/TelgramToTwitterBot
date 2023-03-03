const { Telegraf } = require("telegraf");
const { TwitterApi, TwitterApiV2Settings } = require("twitter-api-v2");

const { IntervalTaskRunner, Interval } = require("interval-task-runner");

const { exec } = require("child_process");
const { series } = require("async");

var shell = require("shelljs");

const fs = require("fs");
const path = require("path");

const Downloader = require("nodejs-file-downloader");
require("dotenv").config();

const getEmoji = require("get-random-emoji");
const textopost = `Follow for more ${getEmoji()} ${getEmoji()} https://es.pornhub.com/model/taylihot \n https://t.me/+NdTEMP4BkkNiYjlh \n https://t.me/pozone`;

TwitterApiV2Settings.deprecationWarnings = false;
const twitterClient = new TwitterApi({
  appKey: process.env.APPKEY,
  appSecret: process.env.APPSECRET,
  accessToken: process.env.ACCESSTOKEN,
  accessSecret: process.env.ACCESSSECRET,
});
const twitter = twitterClient.readWrite;

const bot = new Telegraf(process.env.TELEGRAFTOKEN);

/**
 * El bot escucha el evento de recibir videos
 *
 * @param content - Es el intermediario para recibir y enviar información al usuario que llama al bot de Telegram
 *
 */

bot
  .on("video", async (content) => {
    if (content.message.video.file_size < 510000000) {
      /** Se comprueba si el tamaño del video enviado por telegram es soportado para subir por el bot de twitter */
      await publicarTweetVideo(content);
    } else {
      content.reply("El archivo es muy grande");
    }
  })
  .catch((err) => {
    console.error("Error al arrancar bot para videos", err.data.title);
  });

bot.command("responder", (content) => {
  responderTweetsofList(content);
});

bot
  .on("photo", async (content) => {
    await publicarTweetImagen(content);
  })
  .catch((err) => {
    console.error("Error al arrancar bot para imagenes", err.data.title);
  });

/**
 * Obtiene el video enviado por el bot, lo almacena localmente para que el bot de twitter pueda usarlo y publicarlo
 *
 * @param telegram_content - Recibe toda la metadata del video enviado al bot de telegram
 *
 */
async function publicarTweetImagen(telegram_content) {
  const photo =
    telegram_content.message.photo[telegram_content.message.photo.length - 1];

  await telegram_content.telegram
    .getFileLink(photo.file_id)
    .then(async (value) => {
      const downloader = new Downloader({
        url: value.href,
        directory: "./images",
        fileName: photo.file_id + ".jpg",
        cloneFiles: false,
      });

      try {
        await downloader
          .download()
          .catch((err) =>
            console.log("Error al descargar photo", err)
          ); /**Descarga la imagen en el almacenamiento local */
        await subirImagen(downloader.config.fileName)
          .then(() => {
            telegram_content.reply("Enviado a Twitter");
          })
          .catch((e) => {
            console.error(
              "Ocurrio un error en el envío de la imagen",
              downloader.config.fileName
            );
          });
      } catch (error) {
        console.info("Error global al enviar imagen", error);
      }
    })
    .catch((err) => console.log("Error al publicar photo", err));
}

async function publicarTweetVideo(telegram_content) {
  await telegram_content.telegram
    .getFileLink(telegram_content.message.video.file_id)
    .then(async (value) => {
      const downloader = new Downloader({
        url: value.href,
        directory: "./videos",
        fileName: telegram_content.message.video.file_unique_id + ".mp4",
        cloneFiles: false,
      });
      try {
        await downloader
          .download()
          .catch((err) =>
            console.log("Error al descargar video", err)
          ); /**Descarga el video en el almacenamiento local */
        await subirVideo(downloader.config.fileName)
          .then(() => {
            telegram_content.reply("Enviado a Twitter");
          })
          .catch((e) => {
            console.error(
              "Ocurrio un error en el envío del video",
              downloader.config.fileName
            );
          });
      } catch (error) {
        console.info("Error global al enviar video", error);
      }
    })
    .catch((err) => console.log("Error al publicar video", err));
}

/**
 * Recibe el nombre del video que se va a publicar para que sea buscado localmente y se pueda subir mediante el bot a twitter
 *
 * @param local_video - Nombre del video a subir
 */
async function subirVideo(local_video) {
  try {
    await enviarVideoATelegram(local_video);

    const mediaIdVideo = await twitter.v1
      .uploadMedia("./videos/" + local_video, {
        type: "longmp4",
        media_category: "amplify",
      })
      .catch((err) => console.log("Error al subir media video", err));

    const video = await twitter.v1
      .mediaInfo(mediaIdVideo)
      .catch((err) => console.log("Error al obtener media info video", err));

    await twitter
      .post(`https://api.twitter.com/2/tweets`, {
        media: { media_ids: [video.media_id_string] },
        text: textopost, //Texto que llevará la publicación
      })
      .then(async (result) => {
        //await enviarVideoATelegram(local_video);
        console.info("Enviado con exito el tweet");
      })
      .catch((err) => {
        console.error("Error al enviar el tweet", err.data.title);
      });
  } catch (error) {
    console.error("Ocurrio un error: ", error);
  }
}

async function enviarVideoATelegram(local_video) {
  await bot.telegram
    .sendVideo(process.env.CHANELID, {
      source: "./videos/" + local_video,
    })
    .catch((err) => console.log("Error al enviar video", err));
}

async function subirImagen(local_imagen) {
  try {
    const mediaIdImagen = await twitter.v1
      .uploadMedia("./images/" + local_imagen)
      .catch((err) => console.log("Error al subir photo", err));
    await twitter
      .post(`https://api.twitter.com/2/tweets`, {
        media: { media_ids: [mediaIdImagen] },
        text: textopost, //Texto que llevará la publicación
      })
      .then(async (result) => {
        await enviarImagenATelegram(local_imagen);
        console.info("Enviado con exito el tweet");
      })
      .catch((err) => {
        console.error("Error al enviar el tweet", err.data.title);
      });
  } catch (error) {
    console.error("Ocurrio un error: ", error);
  }
}

/**
 * Funcion de Borrado automatico para mantener el almacenamiento limpio, se elimina cada 24 horas, gracias a un hilo que la ejecuta
 */
const borrado = async function () {
  fs.readdir("./videos", (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join("./videos", file), (err) => {
        if (err) throw err;
      });
    }
  });
  fs.readdir("./images", (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join("./images", file), (err) => {
        if (err) throw err;
      });
    }
  });

  shell.exec("npm restart telbot.js");
};

async function responderTweetsofList(telegram_bot) {
  console.log("Ha iniciado la respuesta automatica de tweets");
  await twitter.v2
    .listTweets(process.env.IDLISTSTR)
    .then((value) => {
      value.data.data.map(async (tweet) => {
        await twitter.v2
          .reply(`${getEmoji()} ${getEmoji()}`, tweet.id)
          .then((value) => {
            console.log("Id del tweet en lista: ", tweet.id);
            console.log("Tweet respondido con exito", value);
            
            telegram_bot.reply(
              `Tweet ${value.data.text} Respondido con exito, enlace https://twitter.com/HotTv69/status/${value.data.id} `
            );
          })
          .catch((err) => console.log("Error al responder tweet", err));
      });
    })
    .catch((err) =>
      console.log("Error al obtener los tweets de la lista", err)
    );
}

const interval = Interval.fromMs(2400000);
const interval2 = Interval.fromMs(3000000);

//const runner = new IntervalTaskRunner(responderTweetsofList, interval).start();
const runner2 = new IntervalTaskRunner(borrado, interval2).start();

bot.launch().then((value) => {
  console.info("Bot iniciado con exito", value);
});

bot.catch((err) => {
  console.log("Se detuvo porque", err);
});

async function enviarImagenATelegram(local_imagen) {
  await bot.telegram
    .sendPhoto(process.env.CHANELID, {
      source: "./images/" + local_imagen,
    })
    .catch((err) => console.log("Error al enviar photo", err));
}
