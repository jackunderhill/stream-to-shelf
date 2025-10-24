import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { BlogPost } from '@/types';

const contentDirectory = path.join(process.cwd(), 'content');

export function getAllBlogPosts(): BlogPost[] {
  try {
    const fileNames = fs.readdirSync(contentDirectory);
    const posts = fileNames
      .filter((name) => name.endsWith('.md'))
      .map((name) => {
        const fullPath = path.join(contentDirectory, name);
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContents);

        return {
          slug: name.replace(/\.md$/, ''),
          title: data.title || 'Untitled',
          description: data.description || '',
          date: data.date || new Date().toISOString(),
          tags: data.tags || [],
          content,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return posts;
  } catch (error) {
    console.error('Error reading blog posts:', error);
    return [];
  }
}

export function getBlogPost(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(contentDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      slug,
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      tags: data.tags || [],
      content,
    };
  } catch (error) {
    console.error('Error reading blog post:', error);
    return null;
  }
}

export function getBlogPostSlugs(): string[] {
  try {
    const fileNames = fs.readdirSync(contentDirectory);
    return fileNames
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''));
  } catch (error) {
    console.error('Error reading blog post slugs:', error);
    return [];
  }
}