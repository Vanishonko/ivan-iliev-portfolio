export type Milestone = {
	year: string;
	title: string;
	body: string;
	kind: 'school' | 'team' | 'solo' | 'work';
};

// The short version of how the work changed: coursework, then a team project,
// then a job-shaped one, then things nobody asked for.
export const milestones: Milestone[] = [
	{
		year: '2021',
		title: 'First repositories',
		body: 'Coursework, algorithms, a Game of Life. Learning what a commit is and why the tests matter.',
		kind: 'school'
	},
	{
		year: '2023',
		title: 'Team projects at school',
		body: 'A C# railway companion and a WPF app built with classmates — deadlines, git conflicts, and the first time software had to be defended in front of someone.',
		kind: 'team'
	},
	{
		year: '2025',
		title: 'BeaverWize and the steel company',
		body: 'A gamified water-conservation app on a SvelteKit + Express microservice stack, and an NDA Laravel application that replaced spreadsheets for one of the largest steel producers in Europe.',
		kind: 'work'
	},
	{
		year: '2026',
		title: 'Games, an AI, and a workshop',
		body: 'driftblock, ai-f1-racing and the dsh-works plugins — the year the projects stopped being assignments.',
		kind: 'solo'
	}
];
