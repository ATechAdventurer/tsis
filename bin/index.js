#!/usr/bin/env node
const fs = require('fs');
const chalk = require('chalk');
const jsonCsv = require('json-2-csv');
const cliProgress = require('cli-progress');
const { program } = require('commander');
const { createApi } = require("instamancer");

program
    .option('-h, --hashtag [tag]', 'Set the Hashtag you want to scrape for')
    .option('-c, --count [number]', 'The number of posts you want')
    .parse(process.argv);

if (!program.hashtag || !program.count) {
    console.log("Missing Arguments -h and/or -c");
    return;
}

const hashtagSearch = createApi("hashtag", program.hashtag, {
    total: program.count,
    fullAPI: true,
    hibernationTime: 3
});

const progress = new cliProgress.SingleBar({
    etaBuffer: 50
}, cliProgress.Presets.shades_classic);

if (program.hashtag.includes("#")) {
    program.hashtag = program.hashtag.replace("#", "");
}

(async () => {
    const files = fs.readdirSync("./", {});
    let data = [];
    if (files.includes(`${program.hashtag}.csv`)) {
        console.warn("!!! A File that corosponds to this hashtag already exists, rename it or delete it before running this command");
        return;
    }
    console.log(chalk.green(`We will begin scraping the first`), chalk.yellowBright(`${program.count}`), chalk.green(`posts with #${program.hashtag}\nThis may take awhile so get comfortable`))
    progress.start(program.count, 0);
    for await (const post of hashtagSearch.generator()) {
        data.push(post);
        progress.increment();
    }
    progress.stop();
    console.log("Done Scraping, writing JSON source file");
    fs.writeFileSync(`${program.hashtag}.json`, JSON.stringify(data, null, 2));
    console.log("Boiling Data");
    let boiledData = data.map(item => {
        const {
            shortcode: post_hash,
            owner: { username: account_name },
            edge_media_preview_like: { count: likes },
            edge_media_preview_comment: { count: comments },
            is_video,
            edge_media_to_caption,
            taken_at_timestamp

        } = item.shortcode_media;
        let caption = "";
        let dateTaken = "";
        try {
            caption = edge_media_to_caption.edges[0].node.text;
            var utcSeconds = 1234567890;
            var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
            dateTaken = d.setUTCSeconds(taken_at_timestamp * 1000).toISOstring();
        } catch (e) { }

        return { post_hash, account_name, likes, comments, url: `https://www.instagram.com/p/${post_hash}`, post_type: is_video ? "Video" : "Photo", caption, posted: dateTaken };
    });
    console.log("Writing CSV...");
    jsonCsv.json2csv(boiledData, (err, csvData) => {
        fs.writeFileSync(`${program.hashtag}.csv`, csvData);
    });
    console.log("Done, Thanks for using TSIS")
})()

