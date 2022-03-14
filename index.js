const puppeteer         = require("puppeteer");
const YAML              = require("yaml");
const color             = require("colors");
const stream            = require('fs');
const {Client, Intents, MessageEmbed} = require("discord.js");
const { stringify }     = require('querystring');
const captcha           = require("2captcha");
const imageToBase64     = require('image-to-base64');

const client            = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
    ]
});

var readyBot = 0;

function dataFolder() {
    return __dirname;
}

const configFile        = stream.readFileSync('config.yml', 'utf8');
const config            = YAML.parse(configFile);

const botToken          = config.settings.bot.token;

const solver = new captcha.Solver(config.settings.captcha.key);

function getTime() {
    var date = new Date();

    var dd = String(date.getDate()).padStart(2, '0');
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var yyyy = date.getFullYear();

    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');
    var seconds = String(date.getSeconds()).padStart(2, '0');

    return hours + ':' + minutes + ':' + seconds + '][' + mm + '/' + dd + '/' + yyyy;
}

async function loginHufi(mssv, txt) {
    console.log(`[${getTime()}] `.blue + `#${mssv} đang đăng nhập.`.green);
    var browser = await puppeteer.launch({
        defaultViewport: null,
        headless: false,
        ignoreHTTPSErrors: true,
        slowMo: 5,
        args: [`--window-size=1000,1070`],
        defaultViewport: {
            width:1000,
            height:1070,
            isMobile: true
        }
    });

    var sinhvienPage = await browser.newPage();
    await sinhvienPage.goto("https://sinhvien.hufi.edu.vn/tra-cuu-thong-tin.html", { waitUntil: 'networkidle0' });

    var mssvInput = await sinhvienPage.waitForSelector('#MaSinhVien', {visible: true});
    await mssvInput.type(mssv);
    
    console.log(`[${getTime()}] `.blue + `#${mssv} đang lấy hình ảnh captcha.`.green);
    var sinhvienCaptchaPage = await browser.newPage();
    var base64img = await (await (await sinhvienCaptchaPage.goto("https://sinhvien.hufi.edu.vn/WebCommon/GetCaptcha")).buffer()).toString('base64');

    var embelmsg3 = new MessageEmbed().setColor("#ffef3b").setTitle("Đang xử lí mã captcha...");
    txt.channel.send({embeds: [embelmsg3]});

    console.log(`[${getTime()}] `.blue + `#${mssv} đang xử lí captcha.`.green);
    solver.imageCaptcha(base64img).then(async(response) => {
        await sinhvienCaptchaPage.close();
        var captchaInput = await sinhvienPage.waitForSelector('#Captcha', {visible: true});
        console.log(`[${getTime()}] `.blue + `#${mssv} mã captcha đã được xử lí: ${(response.data).toUpperCase()}.`.green);
		
        await captchaInput.type((response.data).toUpperCase());
        await sinhvienPage.keyboard.press('Enter');
        await new Promise(r => setInterval(r, 1000));
		
		var moveToTableId = "#ketquaTraCuu > tbody > tr:nth-child(1) > td:nth-child(7) > a:nth-child(1)";

        if (!isNaN(response.data)) {
            var embelmsg2 = new MessageEmbed().setColor("#ff0000").setTitle("Đăng nhập thất bại, vui lòng thử lại!");
            txt.channel.send({embeds: [embelmsg2]});
            await browser.close();
            console.log(`[${getTime()}] `.blue + `#${mssv} lấy lịch học thất bại.`.red);
			console.log("");
            readyBot = 0;
            return;
        }
		
		var timeUrlId = await sinhvienPage.$eval(moveToTableId, (u) => u.href);

        await sinhvienPage.goto(timeUrlId, {waitUntil: 'networkidle0'});

        console.log(`[${getTime()}] `.blue + `#${mssv} đang lấy lịch học trong tuần.`.green);
        var embelmsg2 = new MessageEmbed().setColor("#3ac241").setTitle("Đăng nhập thành công, đang lấy lịch học...");
        await txt.channel.send({embeds: [embelmsg2]});

        await new Promise(r => setInterval(r, 1000));

        await sinhvienPage.screenshot({
            path: `imgs\\${mssv}.png`,
        });
        await browser.close();
        console.log(`[${getTime()}] `.blue + `#${mssv} lấy lịch học thành công.`.green);
        console.log("");
        await txt.channel.send({ files: [{ attachment: `imgs\\${mssv}.png` }] });

        readyBot = 0;
    });
}

client.on("ready", ()=> {
    console.log(`[${getTime()}] `.blue + `Đang hoạt động (${client.user.tag})`.green);
});

client.on("message", async (txt)=> {
    var prefix  = config.settings.command.prefix;
    var args    = txt.content.slice(prefix.length).split(/ +/);
    var cmdName = args.shift().toLocaleUpperCase();
	
    if (txt.author.bot || !txt.content.startsWith(prefix)) return;
    
    if (cmdName == "GET") {
		(await txt).delete();
        if (readyBot == 0) {
            var getMssv = args.shift();
            readyBot    = 1;
            await loginHufi(getMssv, txt);
        } else {
            var embelmsg2 = new MessageEmbed().setColor("#fc0303").setTitle("Có lệnh đang thực thi, vui lòng thử lại sau").setFooter();
            var sended = txt.channel.send({embeds: [embelmsg2]});
			
            setTimeout(async function() {
                (await sended).delete();
            }, 2000);
        }
    }
});

client.login(botToken);