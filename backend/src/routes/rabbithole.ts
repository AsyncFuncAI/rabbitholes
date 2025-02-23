import express from 'express';
import crypto from 'crypto';
import { tavily } from '@tavily/core';
import { openAIService } from '../services/openaiService';
import { SearchQuery } from '../models/SearchQuery';
import OpenAI from 'openai';

interface RabbitHoleSearchRequest {
  query: string;
  previousConversation?: Array<{
    user?: string;
    assistant?: string;
  }>;
  concept?: string;
  followUpMode?: 'expansive' | 'focused';
  parentSearchId?: string;
}

interface SearchResponse {
  response: string;
  followUpQuestions: string[];
  contextualQuery: string;
  sources: Array<{
    title: string;
    url: string;
    uri: string;
    author: string;
    image: string;
  }>;
  images: Array<{
    url: string;
    thumbnail: string;
    description: string;
  }>;
}

//Hash IP Address
const hashIP = (ip: string): string => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

export function setupRabbitHoleRoutes(_runtime: any) {
  const router = express.Router();
  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

  router.post(
    '/rabbitholes/search',
    async (req: express.Request, res: express.Response) => {
      try {
        const {
          query,
          previousConversation,
          concept,
          followUpMode = 'expansive',
          parentSearchId,
        } = req.body as RabbitHoleSearchRequest;

        const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

        try {
          const searchResults = await tavilyClient.search(query, {
            searchDepth: 'basic',
            includeImages: true,
            maxResults: 3,
          });

          // Process conversationContext
          const conversationContext = previousConversation
            ? previousConversation
                .map(
                  (msg) =>
                    (msg.user ? `User: ${msg.user}\n` : '') +
                    (msg.assistant ? `Assistant: ${msg.assistant}\n` : '')
                )
                .join('\n')
            : '';

          // Prepare messages for OpenAI
          const messages = [
            {
              role: 'system',
              content: `You are an AI assistant that helps users explore topics in depth. Format your responses using markdown with headers (####).
  
  Your goal is to provide comprehensive, accurate information while maintaining engagement.
  Base your response on the search results provided, and structure it clearly with relevant sections.
  
  After your main response, include a "Follow-up Questions:" section with 3 concise questions that would help users explore the topic further.
  One of the questions should be a question that is related to the search results, and the other two should be either thought provoking questions or devil's advocate/conspiracy questions.
  `,
            },
            {
              role: 'user',
              content: `Previous conversation:\n${conversationContext}\n\nSearch results about "${query}":\n${JSON.stringify(
                searchResults
              )}\n\nPlease provide a comprehensive response about ${
                concept || query
              }. Include relevant facts, context, and relationships to other topics. Format the response in markdown with #### headers. The response should be ${
                followUpMode === 'expansive'
                  ? 'broad and exploratory'
                  : 'focused and specific'
              }.`,
            },
          ];

          const completion = (await openAIService.createChatCompletion(
            messages,
            'gemini'
          )) as OpenAI.Chat.ChatCompletion;
          const response = completion.choices?.[0]?.message?.content ?? '';

          // Extract follow-up questions
          const followUpSection = response.split('Follow-up Questions:')[1];
          const followUpQuestions = followUpSection
            ? followUpSection
                .trim()
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => line.replace(/^\d+\.\s+/, '').trim())
                .filter((line) => line.includes('?'))
                .slice(0, 3)
            : [];

          // Get main response without follow-up questions
          const mainResponse = response.split('Follow-up Questions:')[0].trim();

          // Process sources and images
          const sources = searchResults.results.map((result: any) => ({
            title: result.title || '',
            url: result.url || '',
            uri: result.url || '',
            author: result.author || '',
            image: result.image || '',
          }));

          const images = searchResults.images.map((result: any) => ({
            url: result.url,
            thumbnail: result.url,
            description: result.description || '',
          }));

          const searchResponse: SearchResponse = {
            response: mainResponse,
            followUpQuestions,
            contextualQuery: query,
            sources,
            images,
          };

          if (parentSearchId) {
            const updatedSearch = await SearchQuery.findByIdAndUpdate(
              parentSearchId,
              {
                $push: {
                  conversationHistory: {
                    query,
                    response: searchResponse,
                  },
                },
              },
              { new: true }
            ).select('query timestamp conversationHistory');

            if (!updatedSearch) {
              throw new Error('Parent search not found');
            }

            res.json({
              ...searchResponse,
              searchId: parentSearchId,
              conversationHistory: updatedSearch.conversationHistory,
            });
          } else {
            const searchQuery = await SearchQuery.create({
              query,
              ipHash: hashIP(
                typeof clientIp === 'string' ? clientIp : 'unknown'
              ),
              userAgent: req.headers['user-agent'] || 'unknown',
              sessionId: req.headers['x-session-id'] || undefined,
              followUpMode,
              concept,
              searchResults: searchResponse,
              conversationHistory: [
                {
                  query,
                  response: searchResponse,
                },
              ],
            });

            res.json({
              ...searchResponse,
              searchId: searchQuery._id,
              conversationHistory: searchQuery.conversationHistory,
            });
          }
        } catch (tavilyError) {
          // Handle Tavily API errors
          console.error('Tavily API error:', tavilyError);
          if (tavilyError instanceof Error) {
            throw new Error(`Search service error: ${tavilyError.message}`);
          } else {
            throw new Error('Search service error');
          }
        }
      } catch (error) {
        if (req.body.query) {
          try {
            const clientIp =
              req.ip || req.headers['x-forwarded-for'] || 'unknown';

            await SearchQuery.create({
              query: req.body.query,
              ipHash: hashIP(
                typeof clientIp === 'string' ? clientIp : 'unknown'
              ),
              userAgent: req.headers['user-agent'] || 'unknown',
              status: 'error',
              error: (error as Error).message,
            });
          } catch (dbError) {
            console.error('Error saving failed search:', dbError);
          }
        }

        console.error('Error in rabbithole search endpoint:', error);

        if ((error as Error).message.includes('429')) {
          res.status(429).json({
            error:
              'Service is temporarily busy. Please try again in a few seconds.',
            retryAfter: '5 seconds',
          });
        } else {
          res.status(500).json({
            error: 'Failed to process search request',
            details: (error as Error).message,
          });
        }
      }
    }
  );

  router.get(
    '/rabbitholes/recent-searches',
    async (req: express.Request, res: express.Response) => {
      try {
        const recentSearches = await SearchQuery.find({ status: 'success' })
          .select('query timestamp searchResults conversationHistory')
          .sort({ timestamp: -1 })
          .limit(5);

        res.json(recentSearches);
      } catch (error) {
        console.error('Error fetching recent searches:', error);
        res.status(500).json({
          error: 'Failed to fetch recent searches',
          details: (error as Error).message,
        });
      }
    }
  );

  router.get(
    '/rabbitholes/search/:id',
    async (req: express.Request, res: express.Response) => {
      try {
        const search = await SearchQuery.findById(req.params.id).select(
          'query timestamp searchResults conversationHistory'
        );

        if (!search) {
          return res.status(404).json({ error: 'Search not found' });
        }

        res.json(search);
      } catch (error) {
        console.error('Error fetching search details:', error);
        res.status(500).json({
          error: 'Failed to fetch search details',
          details: (error as Error).message,
        });
      }
    }
  );

  return router;
}
