  <h1>Saved Books</h1>
  <ul>
    <% books.forEach(book => { %>
      <li>
        <img src="<%= book.cover_url || '/assets/no_cover_available.png' %>" alt="cover" width="80">
        <strong><%= book.title %></strong> — <%= book.author %>
        (<%= book.publish_date %>)
      </li>
    <% }) %>
  </ul>