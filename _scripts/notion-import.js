const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const moment = require('moment');
const path = require('path');
const fs = require('fs');
// or
// import {NotionToMarkdown} from "notion-to-md";

const notion = new Client({
	auth: process.env.NOTION_TOKEN,
});

// passing notion client to the option
const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
	// ensure directory exists
	const root = '_posts'
	fs.mkdirSync(root, { recursive: true })

	const databaseId = process.env.DATABASE_ID;
	// TODO has_more
	const response = await notion.databases.query({
		database_id: databaseId,
		filter: {
			property: "공개",
			checkbox: {
				equals: true
			}
		}
	})
	for (const r of response.results) {
		// console.log(r)
		const id = r.id
		// date
		let date = moment(r.created_time).format("YYYY-MM-DD")
		let pdate = r.properties?.['날짜']?.['date']?.['start']
		if (pdate) {
			date = moment(pdate).format('YYYY-MM-DD')
		}
		// title
		let title = id
		let ptitle = r.properties?.['게시물']?.['title']
		if (ptitle?.length > 0) {
			title = ptitle[0]?.['plain_text']
		}
		// tags
		let tags = []
		let ptags = r.properties?.['태그']?.['multi_select']
		for (const t of ptags) {
			const n = t?.['name']
			if (n) {
				tags.push(n)
			}
		}
		// categories
		let cats = []
		let pcats = r.properties?.['카테고리']?.['multi_select']
		for (const t of pcats) {
			const n = t?.['name']
			if (n) {
				tags.push(n)
			}
		}
		
		// frontmatter
		let fmtags = ''
		let fmcats = ''
		if (tags.length > 0) {
			fmtags += '\ntags: ['
			for (const t of tags) {
				fmtags += t + ', '
			}
            fmtags += ']'
		}
		if (cats.length > 0) {
			fmcats += '\ncategories: ['
			for (const t of cats) {
				fmcats += t + ', '
			}
            fmcats += ']'
		}
		const fm = `---
layout: post
date: ${date}
title: ${title}${fmtags}${fmcats}
---
`
		const mdblocks = await n2m.pageToMarkdown(id);
		const md = n2m.toMarkdownString(mdblocks);

		//writing to file
		const ftitle = `${date}-${title.replaceAll(' ', '-').toLowerCase()}.md`
		fs.writeFile(path.join(root, ftitle), fm + md, (err) => {
			if (err) {
				console.log(err);
			}
		});
	}
})();
