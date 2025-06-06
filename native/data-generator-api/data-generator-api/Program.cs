using Json.Schema;
using Json.Schema.DataGeneration;

var builder = WebApplication.CreateBuilder(args);

var port = args.FirstOrDefault(a => a.StartsWith("--port="))?.Split("=")[1] ?? "5000";

Console.WriteLine($"Port = {port}");

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

var logger = app.Logger;
var lifetime = app.Lifetime;

lifetime.ApplicationStarted.Register(() =>
{
    logger.LogInformation("Thymian JSON Data Generator started.");
});

lifetime.ApplicationStopped.Register(() =>
{
    logger.LogInformation("Thymian JSON Data Generator stopped.");
});

app.MapPost("/generate", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();

    var schema = JsonSchema.FromText(json);

    var generationResult = schema.GenerateData();

    return Results.Json(generationResult.Result);
});

app.Run();
