import express, { Request, Response } from 'express';
import short from 'short-uuid';

import { Authenticate } from '../middleware/auth';
import { db } from '../database/database';
import isNsfw from '../utils/tags';

export const router = express.Router();

// get an images tags
router.get('/images/:imageId/tags', async (req: Request, res: Response) => {
	const { imageId } = req.params;
	const tagIds = await db
		.select('tagId')
		.from('images_tags')
		.where({ imageId })
		.catch((e) => res.status(400).json(e.detail));

	const tags: any = await db
		.select(['tags.id', 'tags.tag', 'tags.nsfw'])
		.from('images_tags')
		.innerJoin('tags', 'images_tags.tagId', 'tags.id')
		.where({ 'images_tags.imageId': imageId })
		.catch((e) => res.status(400).json(e.detail));

	const nsfw = isNsfw(tags);
	if (nsfw) {
		await db('images')
			.where({ id: imageId })
			.update({ nsfw: true });
	} else {
		await db('images')
			.where({ id: imageId })
			.update({ nsfw: false });
	}

	return res.status(200).json(tags);
});
// add a tag to an image
router.post('/images/:imageId/tags', async (req: Request, res: Response) => {
	const { imageId } = req.params;
	let { nsfw, tag } = req.body;
	tag = tag.toLowerCase();

	const tagExists = await db('tags')
		.select('*')
		.where({ tag })
		.then((rows) => {
			if (rows.length === 0) {
				return false;
			}
			return true;
		})
		.catch((e) => res.status(400).json(e.detail));

	if (!tagExists) {
		const id = await short().new();
		await db('tags')
			.insert({
				id,
				tag,
				nsfw
			})
			.catch((e) => res.status(401).json(e.detail));
	}
	const data: any = await db
		.select('*')
		.from('tags')
		.where({ tag })
		.catch((e) => res.status(402).json(e.detail));

	const tagId = data[0].id;

	await db('images_tags')
		.insert({
			imageId,
			tagId
		})
		.catch((e) => res.status(403).json(e.detail));

	if (nsfw) {
		await db('images')
			.where({ id: imageId })
			.update({ nsfw: true });
	}

	return res.status(200).json(data);
});

// remove tag from image

router.delete(
	'/images/:imageId/tags/:tag',
	async (req: Request, res: Response) => {
		const { imageId, tag } = req.params;

		const tagExists = await db('tags')
			.select('*')
			.where({ tag })
			.then((rows) => {
				if (rows.length === 0) {
					return false;
				}
				return true;
			})
			.catch((e) => {
				res.status(409).json(e.detail);
			});
		if (tagExists) {
			const data: any = await db
				.select('id')
				.from('tags')
				.where({ tag })
				.catch((e: any) => res.status(402).json(e.detail));

			const tagId = data[0].id;
			await db('images_tags')
				.where({ tagId, imageId })
				.del()
				.catch((e: any) => res.status(400).json(e.detail));

			return res.status(204).json('success');
		}

		return res.status(404).json('tag not found');
	}
);

export default router;
