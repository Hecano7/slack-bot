describe("Login Test", function() {
  it("Given the right user login & password, should bring up dashboard", function() {
    cy.visit("http://localhost:3000/login");
    cy.get(".action-email")
      .type(Cypress.env("ADMIN_EMAIL"))
      .should("have.value", Cypress.env("ADMIN_EMAIL"));
    cy.get(".action-password")
      .type(Cypress.env("ADMIN_PASSWORD"))
      .should("have.value", Cypress.env("ADMIN_PASSWORD"));
    cy.contains("Login").click();
    cy.url().should("include", "/dashboard","/explorer");
  });
});
