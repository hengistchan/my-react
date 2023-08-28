import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const Child = () => {
	useEffect(() => {
		console.log('child mount');
		return () => {
			console.log('child unmount');
		};
	});
	return <h3>Child</h3>;
};

export function App() {
	const [num, dispatch] = useState(0);
	useEffect(() => {
		console.log('app mount');
		return () => {
			console.log('app unmount');
		};
	}, []);
	useEffect(() => {
		console.log('app update', num);
		return () => {
			console.log('app update unmount');
		};
	}, [num]);
	return (
		<div>
			<button
				onClick={() => {
					dispatch(num + 1);
				}}
			>
				{num === 0 ? <Child /> : 'nonoop'}
			</button>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
