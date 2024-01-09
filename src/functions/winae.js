const { app } = require('@azure/functions');

app.http('winae', {
    methods: ['GET'],
    authLevel: 'admin',
    handler: async (request, context) => {
        

        const name = request.query.get('name') || await request.text() || 'world';

        return { body: `Good, ${name}!` };
    }
});
