const { Telegraf } = require("telegraf");
const { TwitterApi, TwitterApiV2Settings } = require("twitter-api-v2");

const { IntervalTaskRunner, Interval } = require("interval-task-runner");

const fs = require("fs");
const path = require("path");

const Downloader = require("nodejs-file-downloader");
require("dotenv").config();

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
bot.on("video", async (content) => {
  if (content.message.video.file_size < 22062035) {
    /** Se comprueba si el tamaño del video enviado por telegram es soportado para subir por el bot de twitter */
    await publicarTweet(content);
  } else {
    content.reply("El archivo es muy grande");
  }
});


async function publicarTweet(content) {
  await content.telegram
    .getFileLink(content.message.video.file_id)
    .then(async (value) => {
      const downloader = new Downloader({
        url: value.href,
        directory: "./videos",
        fileName: content.message.video.file_unique_id + ".mp4",
        cloneFiles: false,
      });
      try {
        await downloader.download();
        subirVideo(downloader.config.fileName);
        content.reply("Enviado a Twitter");
      } catch (error) {
        console.info(error);
      }
    });
}

async function subirVideo(params) {
  try {
    const mediaIdVideo = await twitter.v1.uploadMedia("./videos/" + params, {
      type: "longmp4",
    });
    const video = await twitter.v1.mediaInfo(mediaIdVideo);

    await twitter
      .post(`https://api.twitter.com/2/tweets`, {
        media: { media_ids: [video.media_id_string] },
        text: `😍😍😈😈🤤🤤`,
      })
      .then((result) => {
        console.info("Enviado con exito el tweet");
      })
      .catch((err) => {
        console.error("Erro al enviar el tweet", err);
      });
  } catch (error) {
    console.error('Ocurrio un error: ',error);
  }
}

const borrado = function () {
  fs.readdir("./videos", (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join("./videos", file), (err) => {
        if (err) throw err;
      });
    }
  });
};
const interval = Interval.fromMs(360000); // Milisegundos.
const runner = new IntervalTaskRunner(borrado, interval).start();

bot.launch().then((value)=>{console.info('Bot iniciado con exito', value);});
