import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.date(),
	}),
});

// Short takes on AWS / Azure announcements. New entries land here first;
// the ones worth a deep dive get promoted to a full blog post.
const news = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.date(),
		provider: z.enum(['aws', 'azure']),
		source: z.string().url(),
		tags: z.array(z.string()).default([]),
	}),
});

export const collections = { blog, news };
