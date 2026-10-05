import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
	const items = await getCollection('news');
	return rss({
		title: 'Johan Alcalá — Cloud News (AWS & Azure)',
		description: "AWS and Azure announcements, read from an architect's seat.",
		site: context.site,
		items: items
			.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
			.map((item) => ({
				title: `[${item.data.provider === 'aws' ? 'AWS' : 'Azure'}] ${item.data.title}`,
				description: item.data.description,
				pubDate: item.data.pubDate,
				link: `/news/${item.id}/`,
				categories: [item.data.provider, ...item.data.tags],
			})),
	});
}
