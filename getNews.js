const puppeteer = require("puppeteer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
let cTab;
let input = process.argv.slice(2);
let myTopics = [input[0], input[1], input[2]];
(async function fn() {
  try {
    let browserOpenPromise = puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"],
    });
    let browser = await browserOpenPromise;
    let allTabsArr = await browser.pages();
    cTab = allTabsArr[0];
    await cTab.goto("https://www.indiatoday.in/foryou");
    await cTab.waitForSelector(".main-category p", { visible: true });
    topic = await cTab.evaluate(function (selector) {
      let topics = {};
      for (let i = 0; i < 15; i++) {
        topics[
          document.querySelectorAll(selector)[i].childNodes[5].innerText
        ] = document
          .querySelectorAll(selector)
          [i].childNodes[1].getAttribute("value");
      }
      return topics;
    }, ".main-category");
    for (let i = 0; i < 3; i++) {
      await cTab.click(`input[value='${topic[myTopics[i]]}'`);
    }

    await cTab.click("input[type='submit']");
    await cTab.waitForSelector(".section-cat-name");
    // console.log(news);
    let news = await getNews(".detail a", ".section-cat-name", myTopics);
    console.log(news);
    // news = await getArticle(news);
    //console.log(news);
    news = await summarizeNews("textarea[maxlength='50000']", news);
    console.log(news);
  } catch (err) {
    console.log(err);
  }
})();

async function getNews(selector1, selector2, myTopics) {
  let news = [];
  let len = await cTab.evaluate(function (selector1) {
    return document.querySelectorAll(selector1).length;
  }, selector1);
  let k = 1;
  for (let i = 0; i < len; i++) {
    try {
      let title = await cTab.evaluate(function (selector1) {
        return document.querySelectorAll(selector1)[i].innerText;
      }, selector1);
      await cTab.waitForSelector(selector1);
      await cTab.waitForSelector(selector2);
      let link = await cTab.evaluate(
        function (selector, i) {
          return document.querySelectorAll(selector)[i].getAttribute("href");
        },
        selector1,
        i
      );
      console.log(link);
      await cTab.goto("https://www.indiatoday.in" + link);
      // await cTab.setDefaultNavigationTimeout(15000);
      try {
        await cTab.waitForSelector(".description");

        let article = await cTab.evaluate(function (selector) {
          let article = "";
          let len = document.querySelector(selector).childNodes.length;
          for (let j = 0; j < len; j++) {
            if (
              document.querySelector(selector).childNodes[j]
                .childElementCount == 0
            )
              article += document.querySelector(selector).childNodes[j]
                .innerHTML;
          }
          return article;
        }, ".description");

        news.push({
          title: title,
          article: article,
          link: "https://www.indiatoday.in" + link,
        });
        console.log(k);
        k++;
        if (k == 6) break;
        await cTab.goBack();
      } catch (err) {
        console.log("Video articles");
        await cTab.goBack();
      }
    } catch (err) {
      console.log("Something Went wrong!!");
      console.log(err);
      await cTab.goBack();
    }
  }

  return news;
}
async function summarizeNews(selector, news) {
  await cTab.goto("http://textsummarization.net/text-summarizer");
  await cTab.waitForSelector(selector);
  let Str = "Here are the articles\n\n";
  for (let i = 0; i < news.length; i++) {
    let art = news[i]["article"];
    await cTab.type(selector, "");
    for (let j = 0; j < art.length + 3000; j++)
      await cTab.keyboard.press("Backspace");

    await cTab.click("#sentnum");
    await cTab.keyboard.press("Backspace");
    await cTab.type("#sentnum", "4");
    await cTab.type(selector, art);
    await cTab.click("input[type='submit']");
    await cTab.waitForSelector(".span5 p");
    let summary = await cTab.evaluate(function (selector) {
      return document.querySelectorAll(selector)[1].innerHTML;
    }, ".span5 p");
    news[i]["article"] = summary;
    summary = summary.split("<br><br>").join("");
    Str = Str + summary + "\n\n\n\n\n";
    await cTab.goBack();
  }
  let pdfDoc = new PDFDocument();
  pdfDoc.pipe(fs.createWriteStream("Report.pdf"));
  Str = Str + "\n\nArticles extracted from India Today Website";
  pdfDoc.text(Str);
  pdfDoc.end();
  return news;
}
