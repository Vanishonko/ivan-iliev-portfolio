export type Milestone = {
	year: string;
	title: string;
	body: string;
	kind: 'start' | 'school' | 'team' | 'work' | 'solo';
};

// Dates here are checkable: the GitHub account is from 2015, the oldest public repositories
// are from 2021, and the school projects from 2023. Everything before that happened before
// there was anything to point at.
export const milestones: Milestone[] = [
	{
		year: '2012',
		title: 'First code',
		body: 'Eight years old, a computer that could be told what to do. Everything on this site is downstream of that afternoon.',
		kind: 'start'
	},
	{
		year: '2015',
		title: 'An account to keep things',
		body: 'Joined GitHub, though the public history only starts later — for the first years the work lived in folders, not repositories.',
		kind: 'school'
	},
	{
		year: '2021',
		title: 'The oldest repositories still here',
		body: 'A Game of Life, a quicksort, a box of ciphers. School exercises and weekend curiosity, kept mostly because deleting them felt wrong.',
		kind: 'school'
	},
	{
		year: '2023',
		title: 'Team projects, now in C#',
		body: 'A railway companion app and a WPF desktop application, built with classmates, on a deadline, for someone other than myself.',
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
		body: 'driftblock, ai-f1-racing, Dewdrop Bend and the dsh-works plugins — the year the projects stopped being assignments.',
		kind: 'solo'
	}
];
