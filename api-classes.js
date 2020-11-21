const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/**
 * This class maintains the list of individual Story instances
 *  It also has some methods for fetching, adding, and removing stories
 */

class StoryList {
	constructor(stories) {
		this.stories = stories;
	}

	/**
	 * This method is designed to be called to generate a new StoryList.
	 *  It:
	 *  - calls the API
	 *  - builds an array of Story instances
	 *  - makes a single StoryList instance out of that
	 *  - returns the StoryList instance.*
	 */

	// TODO: Note the presence of `static` keyword: this indicates that getStories
	// is **not** an instance method. Rather, it is a method that is called on the
	// class directly. Why doesn't it make sense for getStories to be an instance method?

	static async getStories() {
		// query the /stories endpoint (no auth required)
		const response = await axios.get(`${BASE_URL}/stories`);

		// turn the plain old story objects from the API into instances of the Story class
		const stories = response.data.stories.map((story) => new Story(story));

		// build an instance of our own class using the new array of stories
		const storyList = new StoryList(stories);
		return storyList;
	}

	/**
	 * Method to make a POST request to /stories and add the new story to the list
	 * - user - the current instance of User who will post the story
	 * - newStory - a new story object for the API with title, author, and url
	 *
	 * Returns the new story object
	 */

  // add story, sends post request based on user and story data
	async addStory(user, { title, author, url }) {
		const token = user.loginToken;
		const response = await axios({
			method: "POST",
			url: `${BASE_URL}/stories`,
			data: { token, story: { title, author, url } },
		});

		const story = new Story(response.data.story);
		this.stories.unshift(story);
		user.ownStories.unshift(story);

		return story;
  }
  
  // remove story, sends delete request based on user and story data
	async removeStory(user, storyId) {
		const token = user.loginToken;
		await axios({
			url: `${BASE_URL}/stories/${storyId}`,
			method: "DELETE",
			data: { token: user.loginToken },
		});

		// filter out the story whose ID we are removing
		this.stories = this.stories.filter((story) => story.storyId !== storyId);

		// do the same thing for the user's list of stories & their favorites
		user.ownStories = user.ownStories.filter((s) => s.storyId !== storyId);
		user.favorites = user.favorites.filter((s) => s.storyId !== storyId);
	}
}

/**
 * The User class to primarily represent the current user.
 *  There are helper methods to signup (create), login, and getLoggedInUser
 */

class User {
	constructor(userObj) {
		this.username = userObj.username;
		this.name = userObj.name;
		this.createdAt = userObj.createdAt;
		this.updatedAt = userObj.updatedAt;

		// these are all set to defaults, not passed in by the constructor
		this.loginToken = "";
		this.favorites = [];
		this.ownStories = [];
	}

	/* Create and return a new user.
	 *
	 * Makes POST request to API and returns newly-created user.
	 *
	 * - username: a new username
	 * - password: a new password
	 * - name: the user's full name
	 */
  
  // create user
	static async create(username, password, name) {
		const response = await axios.post(`${BASE_URL}/signup`, {
			user: {
				username,
				password,
				name,
			},
		});

		// build a new User instance from the API response
		const newUser = new User(response.data.user);

		// attach the token to the newUser instance for convenience
		newUser.loginToken = response.data.token;

		return newUser;
	}

	/* Login in user and return user instance.

   * - username: an existing user's username
   * - password: an existing user's password
   */

	static async login(username, password) {
		const response = await axios.post(`${BASE_URL}/login`, {
			user: {
				username,
				password,
			},
		});

		// build a new User instance from the API response
		const existingUser = new User(response.data.user);

		// instantiate Story instances for the user's favorites and ownStories
		existingUser.favorites = response.data.user.favorites.map(
			(s) => new Story(s)
		);
		existingUser.ownStories = response.data.user.stories.map((s) => new Story(s));

		// attach the token to the newUser instance for convenience
		existingUser.loginToken = response.data.token;

		return existingUser;
	}

	/** Get user instance for the logged-in-user.
	 *
	 * This function uses the token & username to make an API request to get details
	 *   about the user. Then it creates an instance of user with that info.
	 */

	static async getLoggedInUser(token, username) {
		// if we don't have user info, return null
		if (!token || !username) return null;

		// call the API
		const response = await axios.get(`${BASE_URL}/users/${username}`, {
			params: {
				token,
			},
		});

		// instantiate the user from the API information
		const existingUser = new User(response.data.user);

		// attach the token to the newUser instance for convenience
		existingUser.loginToken = token;

		// instantiate Story instances for the user's favorites and ownStories
		existingUser.favorites = response.data.user.favorites.map(
			(s) => new Story(s)
		);
		existingUser.ownStories = response.data.user.stories.map((s) => new Story(s));
		return existingUser;
	}

	/** Add a story to the list of user favorites and update the API
	 * - story: a Story instance to add to favorites
	 */

	async addFavorite(story) {
		this.favorites.push(story);
		await this._addOrRemoveFavorite("add", story);
	}

	/** Remove a story to the list of user favorites and update the API
	 * - story: the Story instance to remove from favorites
	 */

	async removeFavorite(story) {
		this.favorites = this.favorites.filter((s) => s.storyId !== story.storyId);
		await this._addOrRemoveFavorite("remove", story);
	}

	/** Update API with favorite/not-favorite.
	 *   - newState: "add" or "remove"
	 *   - story: Story instance to make favorite / not favorite
	 * */

	async _addOrRemoveFavorite(newState, story) {
		const method = newState === "add" ? "POST" : "DELETE";
		const token = this.loginToken;
		await axios({
			url: `${BASE_URL}/users/${this.username}/favorites/${story.storyId}`,
			method: method,
			data: { token },
		});
	}

	/** Return true/false if given Story instance is a favorite of this user. */

	isFavorite(story) {
		return this.favorites.some((s) => s.storyId === story.storyId);
	}
}

/**
 * Class to represent a single story.
 */

class Story {
	/**
	 * The constructor is designed to take an object for better readability / flexibility
	 * - storyObj: an object that has story properties in it
	 */

	constructor(storyObj) {
		this.author = storyObj.author;
		this.title = storyObj.title;
		this.url = storyObj.url;
		this.username = storyObj.username;
		this.storyId = storyObj.storyId;
		this.createdAt = storyObj.createdAt;
		this.updatedAt = storyObj.updatedAt;
	}
}
