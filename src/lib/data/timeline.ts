export type Milestone = {
	year: string;
	title: string;
	body: string;
	kind: 'start' | 'school' | 'teach' | 'team' | 'work' | 'solo';
};

// Every beat here came from Ivan directly, or from something checkable on GitHub:
// the account and the Dragons repository are both from September 2015, the oldest
// public repositories are from 2021, and the school projects from 2023.
export const milestones: Milestone[] = [
	{
		year: '2012',
		title: 'Telerik Kids Academy',
		body: 'Eight years old and insufferable about wanting to make games, until my parents signed me up for programming classes. It started with C++ and competitive problems.',
		kind: 'start'
	},
	{
		year: '2014',
		title: 'JavaScript, and a lot of bad games',
		body: 'Moved to the then-new game development course and spent the next years writing small JavaScript games. Most of them live on dead hard drives and USB sticks now.',
		kind: 'school'
	},
	{
		year: '2015',
		title: 'The one that survived',
		body: 'A dragon game, committed a few days after the account was made. It is still here, and it is exactly as good as an eleven-year-old’s first repository should be.',
		kind: 'school'
	},
	{
		year: '2021',
		title: 'Mentor at MindHub',
		body: 'Teaching five- to twelve-year-olds Scratch, logic and problem solving — using games to make algorithmic thinking feel like play. The first time I had to explain something I only half understood.',
		kind: 'teach'
	},
	{
		year: '2023',
		title: 'C#, .NET and other people’s deadlines',
		body: 'Programming classes in high school, a WPF desktop application and a railway companion app built with classmates — software that had to work for someone who was not me.',
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
		title: 'Games, a pond, an AI and a workshop',
		body: 'driftblock, Dewdrop Bend, ai-f1-racing and the dsh-works plugins — the year the projects stopped being assignments.',
		kind: 'solo'
	}
];
